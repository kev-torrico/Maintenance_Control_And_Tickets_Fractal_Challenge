-- ============================================================================
-- Stored Procedures for atomic Ticket creation and State Machine transitions
-- ============================================================================

USE maintenance_tickets_db;

DROP PROCEDURE IF EXISTS sp_create_ticket;
DROP PROCEDURE IF EXISTS sp_transition_ticket_status;

DELIMITER //

-- ----------------------------------------------------------------------------
-- SP 1: Create Ticket + Resolve/Create Asset Code + Insert Initial History
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_create_ticket (
    IN p_title VARCHAR(100),
    IN p_description VARCHAR(250),
    IN p_priority VARCHAR(20),
    IN p_asset_code_name VARCHAR(100),
    IN p_list_id INT,
    IN p_assigned_to INT,
    IN p_created_by VARCHAR(100)
)
BEGIN
    DECLARE v_asset_id INT;
    DECLARE v_ticket_id INT;
    DECLARE v_initial_status VARCHAR(50);
    DECLARE v_next_position INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- 1. Get status name from target list
    SELECT UPPER(TRIM(title)) INTO v_initial_status
    FROM board_list
    WHERE id = p_list_id;

    IF v_initial_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Target list does not exist.';
    END IF;

    -- 2. Find or create Asset Code
    SELECT id INTO v_asset_id
    FROM asset_code
    WHERE UPPER(TRIM(name)) = UPPER(TRIM(p_asset_code_name))
    LIMIT 1;

    IF v_asset_id IS NULL THEN
        INSERT INTO asset_code (name) VALUES (UPPER(TRIM(p_asset_code_name)));
        SET v_asset_id = LAST_INSERT_ID();
    END IF;

    -- 3. Calculate next position at the bottom of the target list
    SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_position
    FROM ticket
    WHERE list_id = p_list_id;

    -- 4. Insert the new Ticket
    INSERT INTO ticket (
        title,
        description,
        position,
        priority,
        status,
        assigned_to,
        asset_code_id,
        list_id
    ) VALUES (
        p_title,
        p_description,
        v_next_position,
        COALESCE(NULLIF(p_priority, ''), 'MEDIUM'),
        v_initial_status,
        p_assigned_to,
        v_asset_id,
        p_list_id
    );

    SET v_ticket_id = LAST_INSERT_ID();

    -- 5. Insert initial audit trail record in Ticket_History (R2.6)
    INSERT INTO ticket_history (
        ticket_id,
        previous_status,
        new_status,
        comment,
        changed_by
    ) VALUES (
        v_ticket_id,
        NULL,
        v_initial_status,
        'Ticket created and registered in the system.',
        p_created_by
    );

    COMMIT;

    -- Return created ticket ID
    SELECT v_ticket_id AS ticket_id, v_initial_status AS status;
END //

-- ----------------------------------------------------------------------------
-- SP 2: Transition Ticket Status + Validate State Machine + Record History
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_transition_ticket_status (
    IN p_ticket_id INT,
    IN p_target_list_id INT,
    IN p_new_position INT,
    IN p_diagnosis TEXT,
    IN p_comment VARCHAR(250),
    IN p_changed_by VARCHAR(100)
)
BEGIN
    DECLARE v_current_status VARCHAR(50);
    DECLARE v_target_status VARCHAR(50);
    DECLARE v_current_diagnosis TEXT;
    DECLARE v_effective_diagnosis TEXT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- 1. Lock ticket row for update to prevent race conditions
    SELECT status, diagnosis INTO v_current_status, v_current_diagnosis
    FROM ticket
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ticket not found.';
    END IF;

    -- 2. Resolve target status from the destination list title
    SELECT UPPER(TRIM(title)) INTO v_target_status
    FROM board_list
    WHERE id = p_target_list_id;

    IF v_target_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Destination list not found.';
    END IF;

    -- 3. State Machine Validation
    -- Allowed transitions:
    --   PENDING -> IN_PROGRESS
    --   IN_PROGRESS -> RESOLVED (requires diagnosis)
    --   IN_PROGRESS -> PENDING (returned for review)
    --   Same status -> Same status (reordering position within the same list)
    IF v_current_status <> v_target_status THEN
        IF NOT (
            (v_current_status = 'PENDING' AND v_target_status = 'IN_PROGRESS') OR
            (v_current_status = 'IN_PROGRESS' AND v_target_status = 'RESOLVED') OR
            (v_current_status = 'IN_PROGRESS' AND v_target_status = 'PENDING')
        ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Invalid state transition according to workflow rules.';
        END IF;

        -- Block transition to RESOLVED without a valid diagnosis
        SET v_effective_diagnosis = COALESCE(NULLIF(TRIM(p_diagnosis), ''), TRIM(v_current_diagnosis));
        IF v_target_status = 'RESOLVED' AND (v_effective_diagnosis IS NULL OR v_effective_diagnosis = '') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'A technical diagnosis is required before marking a ticket as RESOLVED.';
        END IF;
    ELSE
        SET v_effective_diagnosis = COALESCE(NULLIF(TRIM(p_diagnosis), ''), v_current_diagnosis);
    END IF;

    -- 4. Update Ticket state, list, position, and diagnosis
    UPDATE ticket
    SET list_id = p_target_list_id,
        status = v_target_status,
        position = COALESCE(p_new_position, position),
        diagnosis = v_effective_diagnosis
    WHERE id = p_ticket_id;

    -- 5. Record transition in Ticket_History
    IF v_current_status <> v_target_status OR (p_comment IS NOT NULL AND TRIM(p_comment) <> '') THEN
        INSERT INTO ticket_history (
            ticket_id,
            previous_status,
            new_status,
            comment,
            changed_by
        ) VALUES (
            p_ticket_id,
            v_current_status,
            v_target_status,
            COALESCE(NULLIF(TRIM(p_comment), ''), CONCAT('Status updated to ', v_target_status)),
            p_changed_by
        );
    END IF;

    COMMIT;

    -- Return updated ticket state
    SELECT id, status, list_id, position, diagnosis, updated_at
    FROM ticket
    WHERE id = p_ticket_id;
END //

DELIMITER ;