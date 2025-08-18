import { computeRounded, type WorkbookState, type CellAddr } from "./computeWithRounding";
import { formatValue } from "./format";

const A = (s: string) => s as CellAddr;

// Test Results Report
console.log("=== Phase 8 Test Results ===\n");

// Test 1: Bonus dollars equals premium × rate
console.log("Test 1: Bonus dollars equals premium × rate");
const ws1: WorkbookState = { inputs: { "Sheet1!D33": 100000, "Sheet1!H38": 0.07, "Sheet1!H39": 0.10 } as any };
const out1 = computeRounded(ws1, [A("Sheet1!D38"), A("Sheet1!D39")]);
const test1Pass = Math.abs(out1[A("Sheet1!D38")] - 7000) < 0.01 && Math.abs(out1[A("Sheet1!D39")] - 10000) < 0.01;
console.log(`Result: ${test1Pass ? "PASS" : "FAIL"}`);
console.log(`D38 Expected: 7000, Actual: ${out1[A("Sheet1!D38")]}`);
console.log(`D39 Expected: 10000, Actual: ${out1[A("Sheet1!D39")]}\n`);

// Test 2: Growth grid pipeline math
console.log("Test 2: Growth grid pipeline math");
const ws2: WorkbookState = { inputs: { "Sheet1!C38": 1200, "Sheet1!D34": 0.90, "Sheet1!M25": 2.5 } as any };
const out2 = computeRounded(ws2, [A("Sheet1!E38"), A("Sheet1!G38"), A("Sheet1!I38"), A("Sheet1!K38"), A("Sheet1!L38")]);
const test2Pass = Math.abs(out2[A("Sheet1!E38")] - 1200) < 0.01 && 
                  Math.abs(out2[A("Sheet1!G38")] - 120) < 0.01 &&
                  Math.abs(out2[A("Sheet1!I38")] - 110) < 0.01 &&
                  Math.abs(out2[A("Sheet1!K38")] - 110/21) < 0.01 &&
                  Math.abs(out2[A("Sheet1!L38")] - (110/21)/2.5) < 0.01;
console.log(`Result: ${test2Pass ? "PASS" : "FAIL"}`);
console.log(`E38: ${out2[A("Sheet1!E38")]}, G38: ${out2[A("Sheet1!G38")]}, I38: ${out2[A("Sheet1!I38")]}`);
console.log(`K38: ${out2[A("Sheet1!K38")]}, L38: ${out2[A("Sheet1!L38")]}\n`);

// Test 3: Pass-throughs
console.log("Test 3: Pass-throughs");
const ws3: WorkbookState = { inputs: { "Sheet1!E24": 4321, "Sheet1!M25": 1.75 } as any };
const out3 = computeRounded(ws3, [A("Sheet1!D31"), A("Sheet1!D32")]);
const test3Pass = Math.abs(out3[A("Sheet1!D31")] - 4321) < 0.01 && Math.abs(out3[A("Sheet1!D32")] - 1.75) < 0.01;
console.log(`Result: ${test3Pass ? "PASS" : "FAIL"}`);
console.log(`D31: ${out3[A("Sheet1!D31")]}, D32: ${out3[A("Sheet1!D32")]}\n`);

// Test 4: Safe division when mix is 0
console.log("Test 4: Safe division when mix is 0");
const ws4: WorkbookState = { inputs: { "Sheet1!C38": 600, "Sheet1!D34": 0.85, "Sheet1!M25": 0 } as any };
const out4 = computeRounded(ws4, [A("Sheet1!L38")]);
const test4Pass = out4[A("Sheet1!L38")] === 0;
console.log(`Result: ${test4Pass ? "PASS" : "FAIL"}`);
console.log(`L38: ${out4[A("Sheet1!L38")]}\n`);

// Sample outputs test
console.log("Sample outputs: D33=100000, H38=0.07, C38=1200, D34=0.90, M25=2.5");
const wsSample: WorkbookState = { inputs: { 
  "Sheet1!D33": 100000, 
  "Sheet1!H38": 0.07, 
  "Sheet1!C38": 1200, 
  "Sheet1!D34": 0.90, 
  "Sheet1!M25": 2.5 
} as any };
const outSample = computeRounded(wsSample, [A("Sheet1!D38"), A("Sheet1!K38"), A("Sheet1!L38"), A("Sheet1!H38")]);
console.log(`D38: ${outSample[A("Sheet1!D38")]} (Expected: 7000.00)`);
console.log(`K38: ${outSample[A("Sheet1!K38")]} (Expected: ≈5.2381)`);
console.log(`L38: ${outSample[A("Sheet1!L38")]} (Expected: ≈2.0952)`);

// Formatting test
console.log("\nFormatting test:");
console.log(`H38 (percent): ${formatValue(A("Sheet1!H38"), outSample[A("Sheet1!H38")])}`);
console.log(`D38 (money): ${formatValue(A("Sheet1!D38"), outSample[A("Sheet1!D38")])}`);
console.log(`K38 (two_decimals): ${formatValue(A("Sheet1!K38"), outSample[A("Sheet1!K38")])}`);
console.log(`L38 (two_decimals): ${formatValue(A("Sheet1!L38"), outSample[A("Sheet1!L38")])}`);

// Check for NaN/Infinity
const allVals = [...Object.values(out1), ...Object.values(out2), ...Object.values(out3), ...Object.values(out4), ...Object.values(outSample)];
const hasNaN = allVals.some(v => !Number.isFinite(v));
console.log(`\nNo NaN/Infinity: ${!hasNaN ? "PASS" : "FAIL"}`);

console.log("\n=== Summary ===");
console.log(`Test 1 (Bonus dollars): ${test1Pass ? "PASS" : "FAIL"}`);
console.log(`Test 2 (Growth grid pipeline): ${test2Pass ? "PASS" : "FAIL"}`);
console.log(`Test 3 (Pass-throughs): ${test3Pass ? "PASS" : "FAIL"}`);
console.log(`Test 4 (Safe division): ${test4Pass ? "PASS" : "FAIL"}`);
console.log(`No NaN/Infinity: ${!hasNaN ? "PASS" : "FAIL"}`);

export {};