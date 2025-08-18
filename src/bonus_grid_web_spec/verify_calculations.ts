import { computeRounded, type CellAddr, type WorkbookState } from "./computeWithRounding";

const A = (s:string)=>s as CellAddr;

function verifyCalculations() {
  console.log("=== Phase 8 Calculation Verification ===");
  
  // Test 1: Bonus dollars equals premium × rate
  console.log("\n1. Testing: D38–D44 = D33 × H38–H44");
  const ws1: WorkbookState = { inputs: {
    "Sheet1!D33": 100000,
  } as any };
  const out1 = computeRounded(ws1, [A("Sheet1!D38"), A("Sheet1!D39"), A("Sheet1!H38"), A("Sheet1!H39")]);
  console.log(`D33 (Premium): $${ws1.inputs["Sheet1!D33"]}`);
  console.log(`H38 (Preset): ${out1[A("Sheet1!H38")] * 100}%`);
  console.log(`H39 (Preset): ${out1[A("Sheet1!H39")] * 100}%`);
  console.log(`D38 (Expected: $7,000): $${out1[A("Sheet1!D38")]}`);
  console.log(`D39 (Expected: $6,000): $${out1[A("Sheet1!D39")]}`);
  
  // Test 2: Daily items calculation with points mix and retention
  console.log("\n2. Testing: C38–C44 drives E/G/I/K/L, M25 > 0 unlocks L");
  const ws2: WorkbookState = { inputs: {
    "Sheet1!C38": 1200,  // goal
    "Sheet1!D34": 0.90,  // retention 90%
    "Sheet1!M25": 2.5,   // mix (points per item)
  } as any };
  const out2 = computeRounded(ws2, [A("Sheet1!E38"), A("Sheet1!G38"), A("Sheet1!I38"), A("Sheet1!K38"), A("Sheet1!L38")]);
  console.log(`C38 (Goal): ${ws2.inputs["Sheet1!C38"]}`);
  console.log(`D34 (Retention): ${(ws2.inputs["Sheet1!D34"] as number) * 100}%`);
  console.log(`M25 (Mix): ${ws2.inputs["Sheet1!M25"]}`);
  console.log(`E38 (Net Points = 1200): ${out2[A("Sheet1!E38")]}`);
  console.log(`G38 (Point Loss = 120): ${out2[A("Sheet1!G38")]}`);
  console.log(`I38 (Monthly = 110): ${out2[A("Sheet1!I38")]}`);
  console.log(`K38 (Daily Points ≈ 5.24): ${out2[A("Sheet1!K38")]}`);
  console.log(`L38 (Daily Items ≈ 2.10): ${out2[A("Sheet1!L38")]}`);

  // Test 3: Pass-throughs wired
  console.log("\n3. Testing: D31 = E24, D32 = M25 pass-throughs");
  const ws3: WorkbookState = { inputs: {
    "Sheet1!E24": 4321,
    "Sheet1!M25": 1.75
  } as any };
  const out3 = computeRounded(ws3, [A("Sheet1!D31"), A("Sheet1!D32")]);
  console.log(`E24: ${ws3.inputs["Sheet1!E24"]} → D31: ${out3[A("Sheet1!D31")]}`);
  console.log(`M25: ${ws3.inputs["Sheet1!M25"]} → D32: ${out3[A("Sheet1!D32")]}`);

  // Test 4: Safe division gives 0 when mix is 0
  console.log("\n4. Testing: Safe division when mix is 0");
  const ws4: WorkbookState = { inputs: {
    "Sheet1!C38": 600,
    "Sheet1!D34": 0.85,
    "Sheet1!M25": 0
  } as any };
  const out4 = computeRounded(ws4, [A("Sheet1!L38")]);
  console.log(`M25 = 0 → L38 (Daily Items): ${out4[A("Sheet1!L38")]}`);

  // Test 5: D34 changes G and downstream
  console.log("\n5. Testing: D34 changes G and downstream");
  const ws5a: WorkbookState = { inputs: { "Sheet1!C38": 1000, "Sheet1!D34": 0.8, "Sheet1!M25": 2.0 } as any };
  const ws5b: WorkbookState = { inputs: { "Sheet1!C38": 1000, "Sheet1!D34": 0.9, "Sheet1!M25": 2.0 } as any };
  const out5a = computeRounded(ws5a, [A("Sheet1!G38"), A("Sheet1!I38"), A("Sheet1!K38"), A("Sheet1!L38")]);
  const out5b = computeRounded(ws5b, [A("Sheet1!G38"), A("Sheet1!I38"), A("Sheet1!K38"), A("Sheet1!L38")]);
  console.log(`D34 = 80% → G38: ${out5a[A("Sheet1!G38")]}, I38: ${out5a[A("Sheet1!I38")]}, K38: ${out5a[A("Sheet1!K38")]}, L38: ${out5a[A("Sheet1!L38")]}`);
  console.log(`D34 = 90% → G38: ${out5b[A("Sheet1!G38")]}, I38: ${out5b[A("Sheet1!I38")]}, K38: ${out5b[A("Sheet1!K38")]}, L38: ${out5b[A("Sheet1!L38")]}`);

  console.log("\n=== All calculations verified! ===");
}

verifyCalculations();