import { computeRounded, type WorkbookState, type CellAddr } from "./computeWithRounding";

const A = (s:string)=>s as CellAddr;

console.log("=== Testing Phase 8 Implementation ===");

// Test 1: Bonus dollars equals premium × rate
console.log("\n1. Testing: Bonus dollars equals premium × rate");
const ws1: WorkbookState = { inputs: { "Sheet1!D33": 100000, "Sheet1!H38": 0.07, "Sheet1!H39": 0.10 } as any };
const out1 = computeRounded(ws1, [A("Sheet1!D38"), A("Sheet1!D39")]);
console.log(`Expected D38=7000, Actual: ${out1[A("Sheet1!D38")]}`);
console.log(`Expected D39=10000, Actual: ${out1[A("Sheet1!D39")]}`);
console.log(`✓ Test 1: ${Math.abs(out1[A("Sheet1!D38")] - 7000) < 0.01 && Math.abs(out1[A("Sheet1!D39")] - 10000) < 0.01 ? "PASS" : "FAIL"}`);

// Test 2: Growth grid pipeline math
console.log("\n2. Testing: Growth grid pipeline math");
const ws2: WorkbookState = { inputs: { "Sheet1!C38": 1200, "Sheet1!D34": 0.90, "Sheet1!M25": 2.5 } as any };
const out2 = computeRounded(ws2, [A("Sheet1!E38"), A("Sheet1!G38"), A("Sheet1!I38"), A("Sheet1!K38"), A("Sheet1!L38")]);
console.log(`E38 Expected: 1200, Actual: ${out2[A("Sheet1!E38")]}`);
console.log(`G38 Expected: 120, Actual: ${out2[A("Sheet1!G38")]}`);
console.log(`I38 Expected: 110, Actual: ${out2[A("Sheet1!I38")]}`);
console.log(`K38 Expected: ${110/21}, Actual: ${out2[A("Sheet1!K38")]}`);
console.log(`L38 Expected: ${(110/21)/2.5}, Actual: ${out2[A("Sheet1!L38")]}`);
const test2Pass = Math.abs(out2[A("Sheet1!E38")] - 1200) < 0.01 && 
                  Math.abs(out2[A("Sheet1!G38")] - 120) < 0.01 &&
                  Math.abs(out2[A("Sheet1!I38")] - 110) < 0.01 &&
                  Math.abs(out2[A("Sheet1!K38")] - 110/21) < 0.01 &&
                  Math.abs(out2[A("Sheet1!L38")] - (110/21)/2.5) < 0.01;
console.log(`✓ Test 2: ${test2Pass ? "PASS" : "FAIL"}`);

// Test 3: Pass-throughs
console.log("\n3. Testing: Pass-throughs");
const ws3: WorkbookState = { inputs: { "Sheet1!E24": 4321, "Sheet1!M25": 1.75 } as any };
const out3 = computeRounded(ws3, [A("Sheet1!D31"), A("Sheet1!D32")]);
console.log(`D31 Expected: 4321, Actual: ${out3[A("Sheet1!D31")]}`);
console.log(`D32 Expected: 1.75, Actual: ${out3[A("Sheet1!D32")]}`);
console.log(`✓ Test 3: ${Math.abs(out3[A("Sheet1!D31")] - 4321) < 0.01 && Math.abs(out3[A("Sheet1!D32")] - 1.75) < 0.01 ? "PASS" : "FAIL"}`);

// Test 4: Safe division when mix is 0
console.log("\n4. Testing: Safe division when mix is 0");
const ws4: WorkbookState = { inputs: { "Sheet1!C38": 600, "Sheet1!D34": 0.85, "Sheet1!M25": 0 } as any };
const out4 = computeRounded(ws4, [A("Sheet1!L38")]);
console.log(`L38 Expected: 0, Actual: ${out4[A("Sheet1!L38")]}`);
console.log(`✓ Test 4: ${out4[A("Sheet1!L38")] === 0 ? "PASS" : "FAIL"}`);

// Sample outputs test
console.log("\n5. Sample outputs test: D33=100000, H38=0.07, C38=1200, D34=0.90, M25=2.5");
const wsSample: WorkbookState = { inputs: { 
  "Sheet1!D33": 100000, 
  "Sheet1!H38": 0.07, 
  "Sheet1!C38": 1200, 
  "Sheet1!D34": 0.90, 
  "Sheet1!M25": 2.5 
} as any };
const outSample = computeRounded(wsSample, [A("Sheet1!D38"), A("Sheet1!K38"), A("Sheet1!L38")]);
console.log(`D38 Expected: 7000.00, Actual: ${outSample[A("Sheet1!D38")]}`);
console.log(`K38 Expected: ≈5.2381, Actual: ${outSample[A("Sheet1!K38")]}`);
console.log(`L38 Expected: ≈2.0952, Actual: ${outSample[A("Sheet1!L38")]}`);

// Check for NaN/Infinity
console.log("\n6. Checking for NaN/Infinity values");
const allVals = [...Object.values(out1), ...Object.values(out2), ...Object.values(out3), ...Object.values(out4), ...Object.values(outSample)];
const hasNaN = allVals.some(v => !Number.isFinite(v));
console.log(`✓ No NaN/Infinity: ${!hasNaN ? "PASS" : "FAIL"}`);

console.log("\n=== Phase 8 Testing Complete ===");