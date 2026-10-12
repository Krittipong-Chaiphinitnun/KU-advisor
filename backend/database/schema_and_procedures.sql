-- =============================================================================
-- KU-Advisor Database Schema & Procedures Script (T-SQL / Microsoft SQL Server)
-- Project: KU-advisor AI Academic Advising System
-- Environment: Microsoft SQL Server 2016+ / Azure SQL / SSMS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DATABASE CREATION & CONTEXT
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'ku_advisor')
BEGIN
    CREATE DATABASE [ku_advisor];
END
GO

USE [ku_advisor];
GO

-- -----------------------------------------------------------------------------
-- 2. CLEANUP (DROP EXISTING OBJECTS SAFELY)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS [dbo].[trg_after_chat_insert];
DROP TRIGGER IF EXISTS [dbo].[trg_audit_deleted_user];
GO

DROP PROCEDURE IF EXISTS [dbo].[sp_save_chat_log];
DROP PROCEDURE IF EXISTS [dbo].[sp_get_user_history];
GO

DROP FUNCTION IF EXISTS [dbo].[fn_check_daily_quota];
DROP FUNCTION IF EXISTS [dbo].[fn_format_thai_date];
GO

DROP VIEW IF EXISTS [dbo].[v_user_chat_summary];
DROP VIEW IF EXISTS [dbo].[v_frequent_questions];
GO

DROP TABLE IF EXISTS [dbo].[ChatLogs];
DROP TABLE IF EXISTS [dbo].[AdminLogs];
DROP TABLE IF EXISTS [dbo].[Curriculums];
DROP TABLE IF EXISTS [dbo].[Users];
GO


-- =============================================================================
-- 3. TABLE DEFINITIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: Users
-- Description: Stores student, advisor, and administrator accounts.
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[Users] (
    [user_id]           INT IDENTITY(1,1) NOT NULL,
    [student_id]        NVARCHAR(50)      NOT NULL,
    [password_hash]     NVARCHAR(255)     NOT NULL,
    [full_name]         NVARCHAR(200)     NOT NULL,
    [email]             NVARCHAR(150)     NULL,
    [role]              NVARCHAR(20)      NOT NULL CONSTRAINT [DF_Users_role] DEFAULT N'student',
    [faculty]           NVARCHAR(150)     NOT NULL CONSTRAINT [DF_Users_faculty] DEFAULT N'Faculty of Engineering at Sriracha',
    [major]             NVARCHAR(150)     NULL,
    [daily_chat_quota]  INT               NOT NULL CONSTRAINT [DF_Users_daily_quota] DEFAULT 50,
    [total_chats_count] INT               NOT NULL CONSTRAINT [DF_Users_total_chats] DEFAULT 0,
    [last_chat_date]    DATETIME2         NULL,
    [is_active]         BIT               NOT NULL CONSTRAINT [DF_Users_is_active] DEFAULT 1,
    [created_at]        DATETIME2         NOT NULL CONSTRAINT [DF_Users_created_at] DEFAULT GETDATE(),
    [updated_at]        DATETIME2         NOT NULL CONSTRAINT [DF_Users_updated_at] DEFAULT GETDATE(),
    CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([user_id] ASC),
    CONSTRAINT [UQ_Users_student_id] UNIQUE NONCLUSTERED ([student_id] ASC),
    CONSTRAINT [UQ_Users_email] UNIQUE NONCLUSTERED ([email] ASC),
    CONSTRAINT [CK_Users_role] CHECK ([role] IN (N'student', N'advisor', N'admin'))
);
GO

CREATE NONCLUSTERED INDEX [IX_Users_role] ON [dbo].[Users] ([role] ASC);
CREATE NONCLUSTERED INDEX [IX_Users_created_at] ON [dbo].[Users] ([created_at] ASC);
GO


-- -----------------------------------------------------------------------------
-- Table: Curriculums
-- Description: Stores academic programs, degree rules, and curriculum PDF metadata.
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[Curriculums] (
    [curriculum_id]   INT IDENTITY(1,1) NOT NULL,
    [curriculum_code] NVARCHAR(50)      NOT NULL,
    [curriculum_name] NVARCHAR(255)     NOT NULL,
    [faculty]         NVARCHAR(150)     NOT NULL CONSTRAINT [DF_Curriculums_faculty] DEFAULT N'Faculty of Engineering at Sriracha',
    [department]      NVARCHAR(150)     NOT NULL CONSTRAINT [DF_Curriculums_department] DEFAULT N'Computer Engineering and Informatics',
    [degree_level]    NVARCHAR(50)      NOT NULL CONSTRAINT [DF_Curriculums_degree] DEFAULT N'Bachelor',
    [total_credits]   INT               NOT NULL CONSTRAINT [DF_Curriculums_credits] DEFAULT 128,
    [academic_year]   INT               NOT NULL,
    [description]     NVARCHAR(MAX)     NULL,
    [file_path]       NVARCHAR(500)     NULL,
    [is_active]       BIT               NOT NULL CONSTRAINT [DF_Curriculums_is_active] DEFAULT 1,
    [created_at]      DATETIME2         NOT NULL CONSTRAINT [DF_Curriculums_created_at] DEFAULT GETDATE(),
    [updated_at]      DATETIME2         NOT NULL CONSTRAINT [DF_Curriculums_updated_at] DEFAULT GETDATE(),
    CONSTRAINT [PK_Curriculums] PRIMARY KEY CLUSTERED ([curriculum_id] ASC),
    CONSTRAINT [UQ_Curriculums_code] UNIQUE NONCLUSTERED ([curriculum_code] ASC),
    CONSTRAINT [CK_Curriculums_degree] CHECK ([degree_level] IN (N'Bachelor', N'Master', N'Doctorate'))
);
GO

CREATE NONCLUSTERED INDEX [IX_Curriculums_year] ON [dbo].[Curriculums] ([academic_year] ASC);
CREATE NONCLUSTERED INDEX [IX_Curriculums_department] ON [dbo].[Curriculums] ([department] ASC);
GO


-- -----------------------------------------------------------------------------
-- Table: ChatLogs
-- Description: Stores student inquiries, RAG retrieved context, AI answers & telemetry.
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[ChatLogs] (
    [chat_id]          INT IDENTITY(1,1) NOT NULL,
    [user_id]          INT               NOT NULL,
    [session_id]       NVARCHAR(100)     NULL,
    [user_message]     NVARCHAR(MAX)     NOT NULL,
    [bot_response]     NVARCHAR(MAX)     NOT NULL,
    [context_used]     NVARCHAR(MAX)     NULL,
    [image_url]        NVARCHAR(500)     NULL,
    [response_time_ms] INT               NULL,
    [user_rating]      TINYINT           NULL,
    [created_at]       DATETIME2         NOT NULL CONSTRAINT [DF_ChatLogs_created_at] DEFAULT GETDATE(),
    CONSTRAINT [PK_ChatLogs] PRIMARY KEY CLUSTERED ([chat_id] ASC),
    CONSTRAINT [FK_ChatLogs_Users] FOREIGN KEY ([user_id]) 
        REFERENCES [dbo].[Users] ([user_id]) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT [CK_ChatLogs_rating] CHECK ([user_rating] BETWEEN 1 AND 5)
);
GO

CREATE NONCLUSTERED INDEX [IX_ChatLogs_user_id] ON [dbo].[ChatLogs] ([user_id] ASC);
CREATE NONCLUSTERED INDEX [IX_ChatLogs_session_id] ON [dbo].[ChatLogs] ([session_id] ASC);
CREATE NONCLUSTERED INDEX [IX_ChatLogs_created_at] ON [dbo].[ChatLogs] ([created_at] ASC);
GO


-- -----------------------------------------------------------------------------
-- Table: AdminLogs
-- Description: Administrative audit trail and automated trigger log archive.
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[AdminLogs] (
    [log_id]        INT IDENTITY(1,1) NOT NULL,
    [admin_id]      INT               NULL,
    [action]        NVARCHAR(100)     NOT NULL,
    [target_entity] NVARCHAR(100)     NULL,
    [target_id]     NVARCHAR(100)     NULL,
    [details]       NVARCHAR(MAX)     NULL,
    [ip_address]    NVARCHAR(45)      NULL,
    [created_at]    DATETIME2         NOT NULL CONSTRAINT [DF_AdminLogs_created_at] DEFAULT GETDATE(),
    CONSTRAINT [PK_AdminLogs] PRIMARY KEY CLUSTERED ([log_id] ASC),
    CONSTRAINT [FK_AdminLogs_Users] FOREIGN KEY ([admin_id]) 
        REFERENCES [dbo].[Users] ([user_id]) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
);
GO

CREATE NONCLUSTERED INDEX [IX_AdminLogs_admin_id] ON [dbo].[AdminLogs] ([admin_id] ASC);
CREATE NONCLUSTERED INDEX [IX_AdminLogs_action] ON [dbo].[AdminLogs] ([action] ASC);
CREATE NONCLUSTERED INDEX [IX_AdminLogs_created_at] ON [dbo].[AdminLogs] ([created_at] ASC);
GO


-- =============================================================================
-- 4. VIEWS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- View 1: v_user_chat_summary
-- Description: Summarizes total chats per student, today's chats, quota, and last active date.
-- -----------------------------------------------------------------------------
CREATE OR ALTER VIEW [dbo].[v_user_chat_summary]
AS
SELECT 
    u.[user_id],
    u.[student_id],
    u.[full_name],
    u.[role],
    u.[faculty],
    u.[major],
    u.[daily_chat_quota],
    COUNT(c.[chat_id]) AS [total_chats_all_time],
    COUNT(DISTINCT c.[session_id]) AS [total_sessions],
    SUM(CASE WHEN CAST(c.[created_at] AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS [chats_today],
    CASE 
        WHEN (u.[daily_chat_quota] - SUM(CASE WHEN CAST(c.[created_at] AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END)) < 0 
        THEN 0 
        ELSE (u.[daily_chat_quota] - SUM(CASE WHEN CAST(c.[created_at] AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END))
    END AS [remaining_quota_today],
    MIN(c.[created_at]) AS [first_chat_date],
    MAX(c.[created_at]) AS [last_chat_date],
    ROUND(AVG(CAST(c.[response_time_ms] AS FLOAT)), 2) AS [avg_response_time_ms]
FROM [dbo].[Users] u
LEFT JOIN [dbo].[ChatLogs] c ON u.[user_id] = c.[user_id]
GROUP BY 
    u.[user_id],
    u.[student_id],
    u.[full_name],
    u.[role],
    u.[faculty],
    u.[major],
    u.[daily_chat_quota];
GO


-- -----------------------------------------------------------------------------
-- View 2: v_frequent_questions
-- Description: Ranks top asked questions/topics with popularity metrics.
-- -----------------------------------------------------------------------------
CREATE OR ALTER VIEW [dbo].[v_frequent_questions]
AS
SELECT 
    LTRIM(RTRIM(c.[user_message])) AS [question_text],
    COUNT(*) AS [frequency_count],
    COUNT(DISTINCT c.[user_id]) AS [unique_students_count],
    ROUND(AVG(CAST(c.[response_time_ms] AS FLOAT)), 2) AS [avg_response_time_ms],
    ROUND(AVG(CAST(c.[user_rating] AS FLOAT)), 2) AS [avg_feedback_rating],
    MIN(c.[created_at]) AS [first_asked_at],
    MAX(c.[created_at]) AS [latest_asked_at]
FROM [dbo].[ChatLogs] c
WHERE LEN(LTRIM(RTRIM(c.[user_message]))) > 3
GROUP BY LTRIM(RTRIM(c.[user_message]))
HAVING COUNT(*) >= 1;
GO


-- =============================================================================
-- 5. FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Function 1: fn_check_daily_quota
-- Description: Returns the remaining chat quota for a user for today.
-- -----------------------------------------------------------------------------
CREATE OR ALTER FUNCTION [dbo].[fn_check_daily_quota]
(
    @user_id INT
)
RETURNS INT
AS
BEGIN
    DECLARE @daily_quota INT = 0;
    DECLARE @used_today INT = 0;
    DECLARE @remaining INT = 0;
    DECLARE @is_active BIT = 1;

    -- Fetch user daily quota and active status
    SELECT 
        @daily_quota = [daily_chat_quota],
        @is_active   = [is_active]
    FROM [dbo].[Users]
    WHERE [user_id] = @user_id;

    IF @daily_quota IS NULL OR @is_active = 0
    BEGIN
        RETURN 0;
    END

    -- Count chats submitted today
    SELECT @used_today = COUNT(*)
    FROM [dbo].[ChatLogs]
    WHERE [user_id] = @user_id
      AND CAST([created_at] AS DATE) = CAST(GETDATE() AS DATE);

    SET @remaining = @daily_quota - @used_today;

    IF @remaining < 0
    BEGIN
        SET @remaining = 0;
    END

    RETURN @remaining;
END;
GO


-- -----------------------------------------------------------------------------
-- Function 2: fn_format_thai_date
-- Description: Formats DATETIME2 into Thai Buddhist Calendar format string.
-- Example: '2026-09-30 22:07:00' -> '30 กันยายน 2569 เวลา 22:07:00 น.'
-- -----------------------------------------------------------------------------
CREATE OR ALTER FUNCTION [dbo].[fn_format_thai_date]
(
    @datetime DATETIME2
)
RETURNS NVARCHAR(100)
AS
BEGIN
    IF @datetime IS NULL
        RETURN NULL;

    DECLARE @day INT = DAY(@datetime);
    DECLARE @month INT = MONTH(@datetime);
    DECLARE @year_buddhist INT = YEAR(@datetime) + 543;
    DECLARE @time_str NVARCHAR(20) = FORMAT(@datetime, N'HH:mm:ss');
    DECLARE @month_thai NVARCHAR(50);
    DECLARE @result NVARCHAR(100);

    SET @month_thai = CASE @month
        WHEN 1  THEN N'มกราคม'
        WHEN 2  THEN N'กุมภาพันธ์'
        WHEN 3  THEN N'มีนาคม'
        WHEN 4  THEN N'เมษายน'
        WHEN 5  THEN N'พฤษภาคม'
        WHEN 6  THEN N'มิถุนายน'
        WHEN 7  THEN N'กรกฎาคม'
        WHEN 8  THEN N'สิงหาคม'
        WHEN 9  THEN N'กันยายน'
        WHEN 10 THEN N'ตุลาคม'
        WHEN 11 THEN N'พฤศจิกายน'
        WHEN 12 THEN N'ธันวาคม'
        ELSE N''
    END;

    SET @result = CONCAT(@day, N' ', @month_thai, N' ', @year_buddhist, N' เวลา ', @time_str, N' น.');
    RETURN @result;
END;
GO


-- =============================================================================
-- 6. STORED PROCEDURES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Procedure 1: sp_save_chat_log
-- Description: Validates user quota and inserts a new chat log interaction.
-- -----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE [dbo].[sp_save_chat_log]
    @user_id          INT,
    @session_id       NVARCHAR(100),
    @user_message     NVARCHAR(MAX),
    @bot_response     NVARCHAR(MAX),
    @context_used     NVARCHAR(MAX)  = NULL,
    @image_url        NVARCHAR(500)  = NULL,
    @response_time_ms INT            = NULL,
    @new_chat_id      INT            OUTPUT,
    @status_code      NVARCHAR(20)   OUTPUT,
    @status_message   NVARCHAR(255)  OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    SET @new_chat_id    = NULL;
    SET @status_code    = N'SUCCESS';
    SET @status_message = N'Chat log saved successfully.';

    -- Verify user exists and is active
    IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [user_id] = @user_id AND [is_active] = 1)
    BEGIN
        SET @status_code    = N'USER_NOT_FOUND';
        SET @status_message = N'User does not exist or account is deactivated.';
        RETURN;
    END

    -- Verify quota
    DECLARE @remaining_quota INT = [dbo].[fn_check_daily_quota](@user_id);
    IF @remaining_quota <= 0
    BEGIN
        SET @status_code    = N'QUOTA_EXCEEDED';
        SET @status_message = N'Daily advising question quota has been exceeded.';
        RETURN;
    END

    -- Insert new chat interaction
    INSERT INTO [dbo].[ChatLogs] (
        [user_id],
        [session_id],
        [user_message],
        [bot_response],
        [context_used],
        [image_url],
        [response_time_ms],
        [created_at]
    )
    VALUES (
        @user_id,
        @session_id,
        @user_message,
        @bot_response,
        @context_used,
        @image_url,
        @response_time_ms,
        GETDATE()
    );

    SET @new_chat_id = SCOPE_IDENTITY();
END;
GO


-- -----------------------------------------------------------------------------
-- Procedure 2: sp_get_user_history
-- Description: Fetches past chat logs for a specific user with pagination.
-- -----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE [dbo].[sp_get_user_history]
    @user_id INT,
    @limit   INT = 50,
    @offset  INT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF @limit IS NULL OR @limit <= 0
        SET @limit = 50;

    IF @offset IS NULL OR @offset < 0
        SET @offset = 0;

    SELECT 
        c.[chat_id],
        c.[user_id],
        c.[session_id],
        c.[user_message],
        c.[bot_response],
        c.[context_used],
        c.[image_url],
        c.[response_time_ms],
        c.[user_rating],
        c.[created_at],
        [dbo].[fn_format_thai_date](c.[created_at]) AS [created_at_thai]
    FROM [dbo].[ChatLogs] c
    WHERE c.[user_id] = @user_id
    ORDER BY c.[created_at] ASC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY;
END;
GO


-- =============================================================================
-- 7. TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Trigger 1: trg_after_chat_insert
-- Description: AFTER INSERT trigger on ChatLogs to update Users statistics
--              (last active date, total chat count) & log high latency queries.
-- -----------------------------------------------------------------------------
CREATE OR ALTER TRIGGER [dbo].[trg_after_chat_insert]
ON [dbo].[ChatLogs]
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Update Users summary statistics
    UPDATE u
    SET 
        u.[last_chat_date]    = GETDATE(),
        u.[total_chats_count] = u.[total_chats_count] + inserted_data.cnt,
        u.[updated_at]        = GETDATE()
    FROM [dbo].[Users] u
    INNER JOIN (
        SELECT [user_id], COUNT(*) AS cnt
        FROM INSERTED
        GROUP BY [user_id]
    ) inserted_data ON u.[user_id] = inserted_data.[user_id];

    -- Log high latency queries (> 8,000 ms) for performance auditing
    INSERT INTO [dbo].[AdminLogs] (
        [admin_id],
        [action],
        [target_entity],
        [target_id],
        [details],
        [created_at]
    )
    SELECT 
        NULL,
        N'HIGH_LATENCY_ALERT',
        N'ChatLogs',
        CAST(i.[chat_id] AS NVARCHAR(50)),
        CONCAT(N'Chat response latency was ', i.[response_time_ms], N' ms for User ID ', i.[user_id]),
        GETDATE()
    FROM INSERTED i
    WHERE i.[response_time_ms] > 8000;
END;
GO


-- -----------------------------------------------------------------------------
-- Trigger 2: trg_audit_deleted_user
-- Description: INSTEAD OF DELETE trigger on Users to archive user details into
--              AdminLogs before performing cascading cleanup and deletion.
-- -----------------------------------------------------------------------------
CREATE OR ALTER TRIGGER [dbo].[trg_audit_deleted_user]
ON [dbo].[Users]
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Archive deleted user data into AdminLogs
    INSERT INTO [dbo].[AdminLogs] (
        [admin_id],
        [action],
        [target_entity],
        [target_id],
        [details],
        [created_at]
    )
    SELECT 
        NULL,
        N'USER_DELETED_ARCHIVE',
        N'Users',
        CAST(d.[user_id] AS NVARCHAR(50)),
        CONCAT(
            N'Archived user snapshot: student_id=', d.[student_id],
            N', full_name=', d.[full_name],
            N', role=', d.[role],
            N', faculty=', d.[faculty],
            N', total_chats=', d.[total_chats_count],
            N', registered_at=', CONVERT(NVARCHAR(30), d.[created_at], 126)
        ),
        GETDATE()
    FROM DELETED d;

    -- 2. Clean up associated ChatLogs records
    DELETE FROM [dbo].[ChatLogs]
    WHERE [user_id] IN (SELECT [user_id] FROM DELETED);

    -- 3. Execute the actual deletion on Users
    DELETE FROM [dbo].[Users]
    WHERE [user_id] IN (SELECT [user_id] FROM DELETED);
END;
GO


-- =============================================================================
-- 8. SAMPLE SEED DATA (FOR TESTING & SSMS VERIFICATION)
-- =============================================================================

-- Seed Users
SET IDENTITY_INSERT [dbo].[Users] ON;

INSERT INTO [dbo].[Users] ([user_id], [student_id], [password_hash], [full_name], [email], [role], [faculty], [major], [daily_chat_quota])
VALUES
(1, N'admin_ku', N'$2b$12$K8y5k21Jv4qgR6t9sL0G.uE5b7J5Q2H4X3y8M0O9L6K2b8a1c9d8e', N'Administrator Sriracha', N'admin@ku.th', N'admin', N'Faculty of Engineering at Sriracha', N'Computer Engineering', 500),
(2, N'6530300001', N'$2b$12$K8y5k21Jv4qgR6t9sL0G.uE5b7J5Q2H4X3y8M0O9L6K2b8a1c9d8e', N'Somchai Jaidee', N'somchai.j@ku.th', N'student', N'Faculty of Engineering at Sriracha', N'Computer Engineering and Informatics', 50),
(3, N'6530300002', N'$2b$12$K8y5k21Jv4qgR6t9sL0G.uE5b7J5Q2H4X3y8M0O9L6K2b8a1c9d8e', N'Suda Rakrean', N'suda.r@ku.th', N'student', N'Faculty of Engineering at Sriracha', N'Digital and Information Technology', 50);

SET IDENTITY_INSERT [dbo].[Users] OFF;
GO

-- Seed Curriculums
SET IDENTITY_INSERT [dbo].[Curriculums] ON;

INSERT INTO [dbo].[Curriculums] ([curriculum_id], [curriculum_code], [curriculum_name], [faculty], [department], [degree_level], [total_credits], [academic_year], [description])
VALUES
(1, N'CPE-2565', N'หลักสูตรวิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมคอมพิวเตอร์และสารสนเทศศาสตร์ (ปรับปรุง พ.ศ. 2565)', N'Faculty of Engineering at Sriracha', N'Computer Engineering and Informatics', N'Bachelor', 128, 2565, N'หลักสูตรวิศวกรรมคอมพิวเตอร์และสารสนเทศ มุ่งเน้น AI, Cloud และ IoT'),
(2, N'DIT-2565', N'หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาเทคโนโลยีดิจิทัลและสารสนเทศ (หลักสูตร พ.ศ. 2565)', N'Faculty of Engineering at Sriracha', N'Computer Engineering and Informatics', N'Bachelor', 124, 2565, N'หลักสูตรเน้นทักษะ Software Development และ Data Science');

SET IDENTITY_INSERT [dbo].[Curriculums] OFF;
GO

-- Seed ChatLogs (Triggers trg_after_chat_insert will fire and update Users stats)
INSERT INTO [dbo].[ChatLogs] ([user_id], [session_id], [user_message], [bot_response], [context_used], [response_time_ms], [user_rating], [created_at])
VALUES
(2, N'sess_demo_001', N'วิชาบังคับเลือกของนิสิตวิศวะคอมชั้นปีที่ 3 มีอะไรบ้างครับ?', N'สำหรับนิสิตหลักสูตร CPE-2565 ในชั้นปีที่ 3 วิชาเลือกเฉพาะสาขาประกอบด้วย Database Systems และ Software Engineering ครับ', N'CPE-2565 PDF Page 14', 1250, 5, DATEADD(HOUR, -2, GETDATE())),
(2, N'sess_demo_001', N'ต้องลงทะเบียนกี่หน่วยกิตถึงจะจบการศึกษา?', N'ตามโครงสร้างหลักสูตร CPE-2565 นิสิตต้องเก็บหน่วยกิตสะสมรวมไม่น้อยกว่า 128 หน่วยกิตครับ', N'CPE-2565 PDF Page 5', 980, 5, DATEADD(HOUR, -1, GETDATE())),
(3, N'sess_demo_002', N'วิชาบังคับเลือกของนิสิตวิศวะคอมชั้นปีที่ 3 มีอะไรบ้างครับ?', N'สำหรับหลักสูตรวิศวกรรมคอมพิวเตอร์ วิชาเลือกเฉพาะทางปี 3 มีรายวิชา Software Engineering และ Cloud Computing ครับ', N'CPE-2565 PDF Page 14', 1100, 4, DATEADD(MINUTE, -30, GETDATE()));
GO

-- =============================================================================
-- END OF T-SQL SCRIPT
-- =============================================================================
