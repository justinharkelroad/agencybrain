#!/usr/bin/env node

// Gate F: Test deployed edge functions
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

async function testSubmitPublicForm() {
  console.log('Testing submit_public_form deployment...');
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/submit_public_form`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      agencySlug: 'test-agency',
      formSlug: 'test-form', 
      token: 'invalid-token-for-testing',
      teamMemberId: 'test-member',
      submissionDate: '2025-09-10',
      values: { test: true },
    }),
  });
  
  if (response.status === 404) {
    console.error('❌ submit_public_form function not deployed');
    return false;
  }
  
  if (response.status >= 400 && response.status < 500) {
    console.log('✅ submit_public_form function deployed (returns expected error)');
    return true;
  }
  
  console.log('✅ submit_public_form function deployed');
  return true;
}

async function testGateELogs() {
  console.log('Testing test_gate_e_logs deployment...');
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/test_gate_e_logs?scenario=success`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  
  if (response.status === 404) {
    console.error('❌ test_gate_e_logs function not deployed');
    return false;
  }
  
  const data = await response.json();
  if (data.result === 'Success log generated') {
    console.log('✅ test_gate_e_logs function deployed and working');
    return true;
  }
  
  console.log('✅ test_gate_e_logs function deployed');
  return true;
}

async function testGetDashboard() {
  console.log('Testing get_dashboard deployment...');
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/get_dashboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      agencySlug: 'test-agency',
      role: 'Sales',
      consolidateVersions: false,
    }),
  });
  
  if (response.status === 404) {
    console.error('❌ get_dashboard function not deployed');
    return false;
  }
  
  console.log('✅ get_dashboard function deployed');
  return true;
}

async function main() {
  console.log('🧪 Testing deployed edge functions...\n');
  
  const results = await Promise.all([
    testSubmitPublicForm(),
    testGateELogs(),
    testGetDashboard(),
  ]);
  
  const allPassed = results.every(result => result);
  
  console.log('\n📊 Deployment Test Results:');
  console.log(`✅ Functions deployed: ${results.filter(r => r).length}/${results.length}`);
  
  if (allPassed) {
    console.log('🎉 All edge functions deployed successfully!');
    process.exit(0);
  } else {
    console.error('❌ Some edge functions failed deployment tests');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});