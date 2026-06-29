#!/usr/bin/env python3
"""One-shot initializer for Lotus desktop activation tables."""

from __future__ import annotations

import pymysql

HOST = "106.15.250.152"
USER = "root"
PASSWORD = "root.2025"
DATABASE = "lotus_hermes"


def main() -> None:
    conn = pymysql.connect(
        host=HOST,
        user=USER,
        password=PASSWORD,
        charset="utf8mb4",
        connect_timeout=15,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                "CREATE DATABASE IF NOT EXISTS lotus_hermes "
                "DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci"
            )
            cur.execute("USE lotus_hermes")
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS activation_codes (
                  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                  code VARCHAR(64) NOT NULL,
                  expires_at DATETIME NOT NULL,
                  max_activations INT UNSIGNED NOT NULL DEFAULT 1,
                  activation_count INT UNSIGNED NOT NULL DEFAULT 0,
                  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
                  type TINYINT UNSIGNED NOT NULL DEFAULT 1,
                  note VARCHAR(255) NULL,
                  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  PRIMARY KEY (id),
                  UNIQUE KEY uk_code (code),
                  KEY idx_status_expires (status, expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS activation_records (
                  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                  code_id BIGINT UNSIGNED NOT NULL,
                  machine_id VARCHAR(128) NOT NULL,
                  machine_name VARCHAR(128) NULL,
                  app_version VARCHAR(32) NULL,
                  activated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  PRIMARY KEY (id),
                  UNIQUE KEY uk_code_machine (code_id, machine_id),
                  KEY idx_machine (machine_id),
                  CONSTRAINT fk_activation_records_code
                    FOREIGN KEY (code_id) REFERENCES activation_codes (id)
                    ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute("SELECT 1 FROM activation_codes WHERE code=%s", ("LOTUS-DEMO-2026",))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO activation_codes (code, expires_at, max_activations, note)
                    VALUES (%s, DATE_ADD(NOW(), INTERVAL 30 DAY), 1, %s)
                    """,
                    ("LOTUS-DEMO-2026", "demo"),
                )
            cur.execute("SHOW TABLES")
            print("tables:", [row[0] for row in cur.fetchall()])
            cur.execute(
                "SELECT code, expires_at, max_activations, status, type FROM activation_codes"
            )
            for row in cur.fetchall():
                print("code:", row)
        conn.commit()
        print("ok")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
