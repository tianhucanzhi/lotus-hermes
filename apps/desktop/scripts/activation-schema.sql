-- Lotus desktop activation codes (MySQL 5.7+ / MariaDB 10.3+)
-- Database: lotus_hermes

CREATE DATABASE IF NOT EXISTS lotus_hermes
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE lotus_hermes;

CREATE TABLE IF NOT EXISTS activation_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL COMMENT '激活码，建议大写字母+数字',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  max_activations INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '允许绑定的设备数',
  activation_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已绑定设备数',
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  note VARCHAR(255) NULL COMMENT '备注，如客户名/批次',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (code),
  KEY idx_status_expires (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activation_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code_id BIGINT UNSIGNED NOT NULL,
  machine_id VARCHAR(128) NOT NULL COMMENT '设备指纹',
  machine_name VARCHAR(128) NULL COMMENT '主机名',
  app_version VARCHAR(32) NULL,
  activated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_code_machine (code_id, machine_id),
  KEY idx_machine (machine_id),
  CONSTRAINT fk_activation_records_code
    FOREIGN KEY (code_id) REFERENCES activation_codes (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 示例激活码（30 天有效，单设备）— 上线前请替换或删除
INSERT INTO activation_codes (code, expires_at, max_activations, note)
SELECT 'LOTUS-DEMO-2026', DATE_ADD(NOW(), INTERVAL 30 DAY), 1, '演示激活码'
WHERE NOT EXISTS (SELECT 1 FROM activation_codes WHERE code = 'LOTUS-DEMO-2026');
