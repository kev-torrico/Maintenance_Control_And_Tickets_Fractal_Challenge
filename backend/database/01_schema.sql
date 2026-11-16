-- ============================================================================
-- Maintenance Control & Tickets System - Database Schema (MySQL 8.x)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS maintenance_tickets_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE maintenance_tickets_db;

-- Drop tables for clean re-runs
DROP TABLE IF EXISTS ticket_history;
DROP TABLE IF EXISTS ticket;
DROP TABLE IF EXISTS asset_code;
DROP TABLE IF EXISTS board_list;
DROP TABLE IF EXISTS user_board;
DROP TABLE IF EXISTS board;
DROP TABLE IF EXISTS app_user;

-- 1. Users
CREATE TABLE app_user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Boards
CREATE TABLE board (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. User-Board Association
CREATE TABLE user_board (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    board_id INT NOT NULL,
    role ENUM('REPORTER', 'OPERATOR') NOT NULL DEFAULT 'OPERATOR',
    CONSTRAINT fk_user_board_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_board_board FOREIGN KEY (board_id) REFERENCES board(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_board UNIQUE (user_id, board_id)
) ENGINE=InnoDB;

-- 4. Lists
CREATE TABLE board_list (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    board_id INT NOT NULL,
    position INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_list_board FOREIGN KEY (board_id) REFERENCES board(id) ON DELETE CASCADE,
    INDEX idx_board_list_position (board_id, position)
) ENGINE=InnoDB;

-- 5. Asset Codes
CREATE TABLE asset_code (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- 6. Tickets (Core entity)
CREATE TABLE ticket (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(250) NULL,
    position INT NOT NULL DEFAULT 1,
    priority ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    diagnosis TEXT NULL,
    assigned_to INT NULL,
    asset_code_id INT NOT NULL,
    list_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ticket_user FOREIGN KEY (assigned_to) REFERENCES app_user(id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_asset FOREIGN KEY (asset_code_id) REFERENCES asset_code(id) ON DELETE RESTRICT,
    CONSTRAINT fk_ticket_list FOREIGN KEY (list_id) REFERENCES board_list(id) ON DELETE RESTRICT,
    INDEX idx_ticket_list_position (list_id, position),
    INDEX idx_ticket_status (status)
) ENGINE=InnoDB;

-- 7. Ticket History
CREATE TABLE ticket_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    previous_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NOT NULL,
    comment VARCHAR(250) NOT NULL,
    changed_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_ticket FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE CASCADE,
    INDEX idx_history_ticket_created (ticket_id, created_at)
) ENGINE=InnoDB;