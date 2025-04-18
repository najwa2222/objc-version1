-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 18, 2025 at 09:06 PM
-- Server version: 10.4.27-MariaDB
-- PHP Version: 8.2.0

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `base_objection`
--

-- --------------------------------------------------------

--
-- Table structure for table `farmer`
--

CREATE TABLE `farmer` (
  `id` int(11) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `national_id` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `farmer`
--

INSERT INTO `farmer` (`id`, `first_name`, `last_name`, `phone`, `national_id`, `password_hash`, `created_at`) VALUES
(1, 'najwa', 'karrouchi', '12345678', 'admin', '$2b$10$/.RXd1vlYMmM5wm6Mc4EZeRhi7GC1ZGTmEVqoSZ9POwySjzGEfHsi', '2025-04-17 13:43:41'),
(2, 'foulen', 'fouleni', '99145392', '14323058', '$2b$10$F/JVrq4VLRkDJ5qFqULnN.A.YpJw2vYhQLr51xN.EjLSgiXTykmJC', '2025-04-18 16:23:20'),
(3, 'test', 'test', '12345678', '65432187', '$2b$10$cbBEojZuFR1.rQcRfXx1..AxROSgQ8oFshFOjboOgyxO4YQS9RZui', '2025-04-18 16:28:14');

-- --------------------------------------------------------

--
-- Table structure for table `objection`
--

CREATE TABLE `objection` (
  `id` int(11) NOT NULL,
  `farmer_id` int(11) NOT NULL,
  `code` varchar(50) NOT NULL,
  `transaction_number` varchar(100) NOT NULL,
  `status` enum('pending','reviewed','resolved') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `objection`
--

INSERT INTO `objection` (`id`, `farmer_id`, `code`, `transaction_number`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, 'OBJ-1744894129947-399', '11223344', 'reviewed', '2025-04-17 13:48:49', '2025-04-18 19:54:03'),
(2, 1, 'OBJ-1744894206255-493', '11223344', 'pending', '2025-04-17 13:50:06', '2025-04-18 19:54:12'),
(3, 1, 'OBJ-1744894710921-336', '223311', 'resolved', '2025-04-17 13:58:30', '2025-04-18 18:47:13');

-- --------------------------------------------------------

--
-- Table structure for table `password_reset`
--

CREATE TABLE `password_reset` (
  `id` int(11) NOT NULL,
  `farmer_id` int(11) NOT NULL,
  `national_id` varchar(20) NOT NULL,
  `reset_token` varchar(100) NOT NULL,
  `verification_code` varchar(6) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `password_reset`
--

INSERT INTO `password_reset` (`id`, `farmer_id`, `national_id`, `reset_token`, `verification_code`, `created_at`, `expires_at`) VALUES
(2, 1, 'admin', '36f0eff77cb36c24d3b99cdf61e235fc03ef80da0eaa9deff376063de7cbda93', '971443', '2025-04-18 15:22:28', '2025-04-18 16:22:28');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) UNSIGNED NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`session_id`, `expires`, `data`) VALUES
('gQl7WRorRsRxKiTmn-Y1wnqW4yAwOkPI', 1744852091, '{\"cookie\":{\"originalMaxAge\":3600000,\"expires\":\"2025-04-17T01:06:47.268Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"flash\":{}}');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `farmer`
--
ALTER TABLE `farmer`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `objection`
--
ALTER TABLE `objection`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `farmer_id` (`farmer_id`);

--
-- Indexes for table `password_reset`
--
ALTER TABLE `password_reset`
  ADD PRIMARY KEY (`id`),
  ADD KEY `farmer_id` (`farmer_id`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`session_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `farmer`
--
ALTER TABLE `farmer`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `objection`
--
ALTER TABLE `objection`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `password_reset`
--
ALTER TABLE `password_reset`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `objection`
--
ALTER TABLE `objection`
  ADD CONSTRAINT `objection_ibfk_1` FOREIGN KEY (`farmer_id`) REFERENCES `farmer` (`id`);

--
-- Constraints for table `password_reset`
--
ALTER TABLE `password_reset`
  ADD CONSTRAINT `password_reset_ibfk_1` FOREIGN KEY (`farmer_id`) REFERENCES `farmer` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
