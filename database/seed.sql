BEGIN;

INSERT INTO users (id, name, password, employee_id, zoho_id, role)
VALUES
  (
    1,
    'Admin User',
    '$2b$10$3hI/PRIx802dkhNgGvybx.3DxcF/LD8otY1bXT8WzNaBMa1adHNaO',
    'ADM-1001',
    'ZH-1001',
    'admin'
  ),
  (
    2,
    'Ravi Agent',
    '$2b$10$MpAIyyZ.RDZ/.tFzPRld5O5/AHHlUnkPoFVPTFGsAhFPP823d6ZFy',
    'EMP-2041',
    'ZH-9914',
    'agent'
  ),
  (
    3,
    'Neha Agent',
    '$2b$10$vrv75nEXFVqYNR5Oh7W.U.d3viux.K2pjSpMI5eYI0SQu/ZrJeeOO',
    'EMP-2042',
    'ZH-9915',
    'agent'
  )
ON CONFLICT (employee_id) DO UPDATE
SET
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  zoho_id = EXCLUDED.zoho_id,
  role = EXCLUDED.role,
  updated_at = CURRENT_TIMESTAMP;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

INSERT INTO responses (
  id,
  created_at,
  employee_id,
  employee_name,
  zoho_id,
  dialer_id,
  reference_id,
  call_status,
  disposition,
  sub_disposition,
  language,
  remark
)
VALUES
  (
    1,
    CURRENT_TIMESTAMP,
    'EMP-2041',
    'Ravi Agent',
    'ZH-9914',
    'DLR-1001',
    'LBMT2026041513742628',
    'Connected',
    'Positive',
    'NA',
    'Hindi',
    'Customer interested in premium plan. Follow-up tomorrow.'
  ),
  (
    2,
    CURRENT_TIMESTAMP,
    'EMP-2041',
    'Ravi Agent',
    'ZH-9914',
    'DLR-1002',
    'LBMT2026041513742629',
    'Connected',
    'Call Back',
    'Want Callback by Evening',
    'Marathi',
    'Requested callback after 6 PM.'
  ),
  (
    3,
    CURRENT_TIMESTAMP,
    'EMP-2042',
    'Neha Agent',
    'ZH-9915',
    'DLR-1003',
    'LBMT2026041513742630',
    'Not Connected',
    'Not Interested',
    'High ROI',
    'NA',
    'Customer declined after pricing discussion.'
  ),
  (
    4,
    CURRENT_TIMESTAMP,
    'EMP-2042',
    'Neha Agent',
    'ZH-9915',
    'DLR-1004',
    'LBMT2026041513742631',
    'Connected',
    'Already Positive',
    'NA',
    'Other',
    'Demo scheduled for Friday morning.'
  )
ON CONFLICT (id) DO UPDATE
SET
  created_at = EXCLUDED.created_at,
  employee_id = EXCLUDED.employee_id,
  employee_name = EXCLUDED.employee_name,
  zoho_id = EXCLUDED.zoho_id,
  dialer_id = EXCLUDED.dialer_id,
  reference_id = EXCLUDED.reference_id,
  call_status = EXCLUDED.call_status,
  disposition = EXCLUDED.disposition,
  sub_disposition = EXCLUDED.sub_disposition,
  language = EXCLUDED.language,
  remark = EXCLUDED.remark;

SELECT setval('responses_id_seq', (SELECT MAX(id) FROM responses));

COMMIT;
