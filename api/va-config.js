// VA FOIA Office Configuration
const VA_OFFICES = {
  VBA: {
    name: 'Veterans Benefits Administration',
    email: 'FOIA.VBACO@va.gov',
    recordTypes: [
      'benefits',
      'compensation',
      'pension',
      'education',
      'gi_bill',
      'home_loans',
      'life_insurance',
      'fiduciary',
      'vr_e', // Veteran Readiness & Employment
      'workload_statistics',
      'annual_reports'
    ],
    description: 'Claims, benefits, education, loans, insurance'
  },
  VHA: {
    name: 'Veterans Health Administration',
    email: 'vhafoiahelp@va.gov',
    phone: '(833) 880-8500',
    recordTypes: [
      'police_reports',
      'contracts',
      'budget',
      'financial_records',
      'hr_documents',
      'harassment_prevention',
      'disruptive_behavior',
      'crisis_line',
      'hospital_records' // non-personal
    ],
    description: 'Healthcare operations, contracts, HR (not personal medical records)'
  },
  NCA: {
    name: 'National Cemetery Administration',
    email: 'cemncafoia@va.gov',
    recordTypes: [
      'burial_records',
      'cemetery_history',
      'headstone_records',
      'memorial_records'
    ],
    description: 'Cemetery and burial records'
  },
  OIG: {
    name: 'Office of Inspector General',
    email: 'VAOIGFOIA-PA@va.gov',
    recordTypes: [
      'investigations',
      'audits',
      'oig_reports',
      'inspector_general'
    ],
    description: 'OIG investigations, audits, reports'
  },
  GENERAL: {
    name: 'VA General FOIA Help',
    email: 'FOIAHelp@va.gov',
    recordTypes: ['other', 'unknown', 'general'],
    description: 'General inquiries or unclear record types'
  }
};

// Function to route request to correct VA office
function getVAOffice(recordType) {
  for (const [officeCode, office] of Object.entries(VA_OFFICES)) {
    if (office.recordTypes.includes(recordType.toLowerCase())) {
      return {
        code: officeCode,
        ...office
      };
    }
  }
  // Default to general help if no match
  return {
    code: 'GENERAL',
    ...VA_OFFICES.GENERAL
  };
}

// Get all record types for frontend dropdown
function getAllRecordTypes() {
  const types = [];
  for (const office of Object.values(VA_OFFICES)) {
    for (const recordType of office.recordTypes) {
      types.push({
        value: recordType,
        label: recordType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        office: office.name
      });
    }
  }
  return types.sort((a, b) => a.label.localeCompare(b.label));
}

module.exports = {
  VA_OFFICES,
  getVAOffice,
  getAllRecordTypes
};
