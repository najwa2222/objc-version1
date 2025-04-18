require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const { body, validationResult } = require('express-validator');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const path = require('path');
const exphbs = require('express-handlebars');
const moment = require('moment');
moment.locale('ar');
const helmet = require('helmet');
const app = express();
const crypto = require('crypto');

// Enhanced security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'cdnjs.cloudflare.com','cdn.jsdelivr.net'],
      styleSrc: ["'self'", 'fonts.googleapis.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', "'unsafe-inline'"],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:']
    }
  }
}));

const hbs = exphbs.create({
  extname: '.hbs',
  defaultLayout: 'main',
  helpers: {
    formatDate: date => {
      // Add dir="ltr" to ensure Latin numerals
      return date ? moment(date).locale('en').format('YYYY-MM-DD HH:mm') : '';
    },
    arStatus: status => {
      const statuses = {
        pending: 'قيد الانتظار',
        reviewed: 'قيد المراجعة',
        resolved: 'تم الحل',
      };
      return statuses[status] || status;
    },
    eq: function(a, b) {
      return a == b;
    },
    range: function(start, end) {
      const result = [];
      for (let i = start; i <= end; i++) {
        result.push(i);
      }
      return result;
    },
    getBadgeClass: status => {
      switch (status) {
        case 'pending':
          return 'warning';
        case 'reviewed':
          return 'info';
        case 'resolved':
          return 'success';
        default:
          return 'secondary';
      }
    }
  }
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV == 'production',
    maxAge: 3600000 // 1 hour
  }
}));

app.use(flash());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());  // Add JSON parser
app.use(express.static(path.join(__dirname, 'public')));

app.use('/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')));
app.use('/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));

// Flash messages middleware
app.use((req, res, next) => {
  res.locals.flash = {
    success: req.flash('success'),
    error: req.flash('error')
  };
  res.locals.session = req.session;
  next();
});

// Authentication middleware
const requireFarmer = (req, res, next) => {
  if (!req.session.farmerId) {
    req.flash('error', 'الرجاء تسجيل الدخول أولاً');
    return res.redirect('/farmer/login');
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.admin) {
    req.flash('error', 'غير مصرح بالوصول');
    return res.redirect('/admin/login');
  }
  next();
};

const checkSubmissionEligibility = async (farmerId) => {
  const [objections] = await pool.execute(
    'SELECT * FROM objection WHERE farmer_id = ? AND status IN ("pending", "reviewed")',
    [farmerId]
  );
  return objections.length == 0;
};

// Initialize Database function
async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Create farmer table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS farmer (
        id INT AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        national_id VARCHAR(20) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create objection table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS objection (
        id INT AUTO_INCREMENT PRIMARY KEY,
        farmer_id INT NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        transaction_number VARCHAR(100) NOT NULL,
        status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (farmer_id) REFERENCES farmer(id)
      )
    `);
        
    // Create password reset table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS password_reset (
        id INT AUTO_INCREMENT PRIMARY KEY,
        farmer_id INT NOT NULL,
        national_id VARCHAR(20) NOT NULL,
        reset_token VARCHAR(100) NOT NULL,
        verification_code VARCHAR(6) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        FOREIGN KEY (farmer_id) REFERENCES farmer(id)
      )
    `);
    
    connection.release();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

// --------------------------
// All Original Routes Maintained
// --------------------------

// Home Route
app.get('/', (req, res) => res.render('home'));

// Farmer Registration
app.get('/farmer/register', (req, res) => res.render('farmer_register'));
app.post('/farmer/register', [
  body('national_id').isLength({ min: 5 }).withMessage('رقم الهوية غير صالح'),
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  body('confirm_password').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('كلمات المرور غير متطابقة');
    }
    return true;
  })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('farmer_register', { errors: errors.array() });
  }

  try {
    // Check if farmer with this national ID already exists
    const [existingFarmers] = await pool.execute(
      'SELECT * FROM farmer WHERE national_id = ?',
      [req.body.national_id]
    );
    console.log(existingFarmers.length);
    if (existingFarmers.length > 0) {
      req.flash('error', 'رقم الهوية الوطنية مسجل مسبقاً. إذا كنت تملك حساباً بالفعل، يمكنك <a href="/farmer/login">تسجيل الدخول</a>');
      return res.redirect('/farmer/login');
    }
    
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    // Remove confirm_password from data to insert
    const { confirm_password, ...farmerData } = req.body;
    
    await pool.execute(
      'INSERT INTO farmer (first_name, last_name, phone, national_id, password_hash) VALUES (?, ?, ?, ?, ?)', 
      [farmerData.first_name, farmerData.last_name, farmerData.phone, farmerData.national_id, hashedPassword]
    );
    req.flash('success', 'تم التسجيل بنجاح');
    res.redirect('/farmer/login');
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error', 'خطأ في التسجيل - ربما الهوية الوطنية مسجلة مسبقاً');
    res.redirect('/farmer/register');
  }
});

// Farmer Login
app.get('/farmer/login', (req, res) => res.render('farmer_login'));
app.post('/farmer/login', async (req, res) => {
  try {
    const [farmers] = await pool.execute(
      'SELECT * FROM farmer WHERE national_id = ?',
      [req.body.national_id]
    );
    
    if (farmers.length == 0 || !await bcrypt.compare(req.body.password, farmers[0].password_hash)) {
      req.flash('error', 'بيانات الدخول غير صحيحة. الرجاء التحقق من رقم الهوية وكلمة المرور. إذا نسيت كلمة المرور، يمكنك <a href="/farmer/forgot-password">استعادتها</a>');
      return res.redirect('/farmer/login');
    }

    req.session.farmerId = farmers[0].id;
    // Add user data to session
    req.session.user = {
      id: farmers[0].id,
      first_name: farmers[0].first_name,
      last_name: farmers[0].last_name
    };
    
    res.redirect('/farmer/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'خطأ في النظام');
    res.redirect('/farmer/login');
  }
});

// Forgot Password Routes
app.get('/farmer/forgot-password', (req, res) => res.render('forgot_password'));
app.post('/farmer/forgot-password', async (req, res) => {
  try {
    // Check if farmer exists with the provided national_id and phone
    const [farmers] = await pool.execute(
      'SELECT * FROM farmer WHERE national_id = ? AND phone = ?',
      [req.body.national_id, req.body.phone]
    );
    
    if (farmers.length == 0) {
      req.flash('error', 'لم يتم العثور على مزارع بهذه البيانات');
      return res.redirect('/farmer/forgot-password');
    }
    
    // Generate a random 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Store the verification code and token in database
    await pool.execute(
      'DELETE FROM password_reset WHERE farmer_id = ?',
      [farmers[0].id]
    );
    
    // Insert new reset record with 1 hour expiry
    await pool.execute(
      'INSERT INTO password_reset (farmer_id, national_id, reset_token, verification_code, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))',
      [farmers[0].id, farmers[0].national_id, resetToken, verificationCode]
    );
    
    // In a real system, you would send SMS with code here
    console.log(`Verification code for ${farmers[0].national_id}: ${verificationCode}`);
    
    // Redirect to verification page
    res.render('verify_code', { national_id: farmers[0].national_id });
  } catch (error) {
    console.error('Forgot password error:', error);
    req.flash('error', 'حدث خطأ في معالجة الطلب');
    res.redirect('/farmer/forgot-password');
  }
});

// Verify Code Route
app.post('/farmer/verify-code', async (req, res) => {
  try {
    const { national_id, code1, code2, code3, code4, code5, code6 } = req.body;
    const verificationCode = code1 + code2 + code3 + code4 + code5 + code6;
    
    // Find the password reset record
    const [resetRecords] = await pool.execute(
      'SELECT * FROM password_reset WHERE national_id = ? AND verification_code = ? AND expires_at > NOW()',
      [national_id, verificationCode]
    );
    
    if (resetRecords.length == 0) {
      req.flash('error', 'رمز التحقق غير صحيح أو منتهي الصلاحية');
      return res.render('verify_code', { national_id });
    }
    
    // Render password reset form
    res.render('reset_password', { 
      national_id,
      reset_token: resetRecords[0].reset_token
    });
  } catch (error) {
    console.error('Verification error:', error);
    req.flash('error', 'حدث خطأ في عملية التحقق');
    res.redirect('/farmer/forgot-password');
  }
});

// Reset Password Route
app.post('/farmer/reset-password', [
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  body('confirm_password').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('كلمات المرور غير متطابقة');
    }
    return true;
  })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('reset_password', { 
      errors: errors.array(),
      national_id: req.body.national_id,
      reset_token: req.body.reset_token
    });
  }
  
  try {
    // Verify reset token
    const [resetRecords] = await pool.execute(
      'SELECT * FROM password_reset WHERE national_id = ? AND reset_token = ? AND expires_at > NOW()',
      [req.body.national_id, req.body.reset_token]
    );
    
    if (resetRecords.length == 0) {
      req.flash('error', 'رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية');
      return res.redirect('/farmer/forgot-password');
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    
    // Update farmer password
    await pool.execute(
      'UPDATE farmer SET password_hash = ? WHERE national_id = ?',
      [hashedPassword, req.body.national_id]
    );
    
    // Delete reset record
    await pool.execute(
      'DELETE FROM password_reset WHERE farmer_id = ?',
      [resetRecords[0].farmer_id]
    );
    
    req.flash('success', 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول');
    res.redirect('/farmer/login');
  } catch (error) {
    console.error('Password reset error:', error);
    req.flash('error', 'حدث خطأ في إعادة تعيين كلمة المرور');
    res.redirect('/farmer/forgot-password');
  }
});

// Farmer Dashboard
app.get('/farmer/dashboard', requireFarmer, async (req, res) => {
  try {
    const [objections] = await pool.execute(
      'SELECT * FROM objection WHERE farmer_id = ? ORDER BY created_at DESC',
      [req.session.farmerId]
    );
    
    const canSubmitNewObjection = await checkSubmissionEligibility(req.session.farmerId);
    
    res.render('farmer_dashboard', { 
      objections,
      canSubmitNewObjection
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error', 'خطأ في تحميل البيانات');
    res.redirect('/');
  }
});

// New Objection
app.get('/objection/new', requireFarmer, async (req, res) => {
  try {
    const canSubmit = await checkSubmissionEligibility(req.session.farmerId);
    if (!canSubmit) {
      req.flash('error', 'لديك اعتراض قيد المعالجة. لا يمكن تقديم اعتراض جديد حتى معالجة الاعتراض الحالي');
      return res.redirect('/farmer/dashboard');
    }
    res.render('objection_new');
  } catch (error) {
    console.error('Error checking eligibility:', error);
    req.flash('error', 'خطأ في النظام');
    res.redirect('/farmer/dashboard');
  }
});

app.post('/objection/new', requireFarmer, [
  body('transaction_number').notEmpty().withMessage('رقم المعاملة مطلوب')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('objection_new', { errors: errors.array() });
  }

  try {
    // Check eligibility
    const canSubmit = await checkSubmissionEligibility(req.session.farmerId);
    if (!canSubmit) {
      req.flash('error', 'لديك اعتراض قيد المعالجة. لا يمكن تقديم اعتراض جديد حتى معالجة الاعتراض الحالي');
      return res.redirect('/farmer/dashboard');
    }
    
    // Modify the code generation to make it smaller
    const code = `OBJ-${Math.floor(1000 + Math.random() * 9000)}`;
    
    await pool.execute(
      'INSERT INTO objection (farmer_id, code, transaction_number, status) VALUES (?, ?, ?, ?)',
      [req.session.farmerId, code, req.body.transaction_number, 'pending']
    );
    req.flash('success', 'تم تقديم الاعتراض بنجاح');
    res.redirect('/farmer/dashboard');
  } catch (error) {
    console.error('New objection error:', error);
    req.flash('error', 'خطأ في تقديم الاعتراض');
    res.redirect('/objection/new');
  }
});

// Admin Routes
app.get('/admin/login', (req, res) => res.render('admin_login'));
app.post('/admin/login', async (req, res) => {
  // Fix the environment variable name
  if (req.body.username == process.env.ADMIN_USERNAME && 
      await bcrypt.compare(req.body.password, process.env.ADMIN_PASSWORD_HASH)) {
    req.session.admin = true;
    return res.redirect('/admin/dashboard');
  }
  req.flash('error', 'بيانات الدخول غير صحيحة');
  res.redirect('/admin/login');
});

// Admin Dashboard - Modified to include search functionality
app.get('/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const searchTerm = req.query.search || '';
    
    // Base query parameters
    let countQuery = 'SELECT COUNT(*) as total FROM objection WHERE status IN ("pending", "reviewed")';
    let objectionsQuery = `
      SELECT o.*, f.first_name, f.last_name 
      FROM objection o
      JOIN farmer f ON o.farmer_id = f.id
      WHERE o.status IN ("pending", "reviewed")
    `;
    
    // Add search condition if provided
    const queryParams = [];
    if (searchTerm) {
      countQuery += ' AND transaction_number LIKE ?';
      objectionsQuery += ' AND transaction_number LIKE ?';
      queryParams.push(`%${searchTerm}%`);
    }
    
    // Get total count for pagination
    const [countResult] = await pool.execute(countQuery, queryParams);
    const totalCount = countResult[0].total;
    const totalPages = Math.ceil(totalCount / limit);
    
    // Complete the query with ordering and limit
    objectionsQuery += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);
    
    // Execute the query
    const [objections] = await pool.execute(objectionsQuery, queryParams);
    
    res.render('admin_dashboard', { 
      objections,
      page,
      totalPages,
      searchTerm
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    req.flash('error', 'خطأ في تحميل البيانات');
    res.redirect('/admin/login');
  }
});

// Admin Archive - Modified to include search functionality
app.get('/admin/archive', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const searchTerm = req.query.search || '';
    
    // Base query parameters
    let countQuery = 'SELECT COUNT(*) as total FROM objection WHERE status = "resolved"';
    let objectionsQuery = `
      SELECT o.*, f.first_name, f.last_name 
      FROM objection o
      JOIN farmer f ON o.farmer_id = f.id
      WHERE o.status = "resolved"
    `;
    
    // Add search condition if provided
    const queryParams = [];
    if (searchTerm) {
      countQuery += ' AND transaction_number LIKE ?';
      objectionsQuery += ' AND transaction_number LIKE ?';
      queryParams.push(`%${searchTerm}%`);
    }
    
    // Get total count for pagination
    const [countResult] = await pool.execute(countQuery, queryParams);
    const totalCount = countResult[0].total;
    const totalPages = Math.ceil(totalCount / limit);
    
    // Complete the query with ordering and limit
    // Use created_at instead of reviewed_at for sorting
    objectionsQuery += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);
    
    // Execute the query
    const [objections] = await pool.execute(objectionsQuery, queryParams);
    
    res.render('admin_archive', { 
      objections,
      page,
      totalPages,
      searchTerm
    });
  } catch (error) {
    console.error('Admin archive error:', error);
    req.flash('error', 'خطأ في تحميل بيانات الأرشيف');
    res.redirect('/admin/dashboard');
  }
});

// Objection Management
app.post('/admin/objection/:id/review', requireAdmin, async (req, res) => {
  try {
    await pool.execute(
      'UPDATE objection SET status = "reviewed" WHERE id = ?',
      [req.params.id]
    );
    req.flash('success', 'تم مراجعة الاعتراض');
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Review objection error:', error);
    req.flash('error', 'خطأ في التحديث');
    res.redirect('/admin/dashboard');
  }
});

app.post('/admin/objection/:id/resolve', requireAdmin, async (req, res) => {
  try {
    await pool.execute(
      'UPDATE objection SET status = "resolved" WHERE id = ?',
      [req.params.id]
    );
    req.flash('success', 'تم حل الاعتراض');
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Resolve objection error:', error);
    req.flash('error', 'خطأ في التحديث');
    res.redirect('/admin/dashboard');
  }
});

// Logout Routes
app.get('/farmer/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Debug route
app.get('/debug/env', (req, res) => {
  if (process.env.NODE_ENV == 'development') {
    res.json({
      NODE_ENV: process.env.NODE_ENV,
      DB_HOST: process.env.DB_HOST,
      DB_NAME: process.env.DB_NAME,
      ADMIN_USERNAME: process.env.ADMIN_USERNAME ? '✓ Set' : '✗ Not set'
    });
  } else {
    res.status(403).send('Debug routes only available in development mode.');
  }
});

// Error Handling
app.use((req, res) => {
  res.status(404).render('error', { 
    status: 404,
    message: 'الصفحة غير موجودة',
    layout: false
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('error', {
    status: 500,
    message: 'حدث خطأ غير متوقع',
    error: process.env.NODE_ENV == 'development' ? err : {},
    layout: false
  });
});

// Initialize database and start server
initDatabase().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to start server:', err);
});