USE maintenance_tickets_db;

-- Reset tables and AUTO_INCREMENT counters safely
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE ticket_history;
TRUNCATE TABLE ticket;
TRUNCATE TABLE asset_code;
TRUNCATE TABLE board_list;
TRUNCATE TABLE user_board;
TRUNCATE TABLE board;
TRUNCATE TABLE app_user;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Seed Users / Operators
INSERT INTO app_user (full_name, email) VALUES
('Juan Perez', 'juan.perez@fractal.com'),
('Luis Paredes', 'luis.paredes@fractal.com'),
('Maria Lopez', 'maria.lopez@fractal.com');

-- 2. Seed Main Maintenance Board
INSERT INTO board (title, status) VALUES
('Maintenance & Infrastructure Control', 'ACTIVE');

-- 3. Associate Users to Board
INSERT INTO user_board (user_id, board_id, role) VALUES
(1, 1, 'OPERATOR'),
(2, 1, 'OPERATOR'),
(3, 1, 'REPORTER');

-- 4. Seed Workflow Lists (Positions 1, 2, 3)
INSERT INTO board_list (title, board_id, position) VALUES
('PENDING', 1, 1),
('IN_PROGRESS', 1, 2),
('RESOLVED', 1, 3);

-- 5. Seed Tickets using the Stored Procedure
CALL sp_create_ticket('Cajero fuera de servicio', 'Pantalla sin respuesta al iniciar transacción.', 'HIGH', 'ATM-0451', 1, 1, 'Maria Lopez');
CALL sp_create_ticket('Fuga en tubería piso 2', 'Filtración detectada cerca del cuarto de servidores.', 'MEDIUM', 'SEDE-LIM', 1, NULL, 'Maria Lopez');
CALL sp_create_ticket('UPS con alarma', 'Batería de respaldo emitiendo alerta sonora intermitente.', 'HIGH', 'SEDE-ARE', 1, 2, 'Maria Lopez');
CALL sp_create_ticket('Cambio de lector de tarjeta', 'Lector magnético desgastado, requiere reemplazo.', 'MEDIUM', 'ATM-0210', 1, 1, 'Maria Lopez');

-- 6. Transition sample tickets
CALL sp_transition_ticket_status(3, 2, 1, NULL, 'Revisando banco de baterías del UPS.', 'Juan Perez');
CALL sp_transition_ticket_status(4, 2, 1, NULL, 'Iniciando desmontaje de lector frontal.', 'Luis Paredes');
CALL sp_transition_ticket_status(4, 3, 1, 'Lector magnético reemplazado y calibrado con pruebas exitosas.','Pruebas de funcionamiento aprobadas.', 'Luis Paredes');