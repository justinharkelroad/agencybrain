// deno-lint-ignore-file no-explicit-any
export async function sendEmailSG(msg: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
}) {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  if (!apiKey) throw new Error("SENDGRID_API_KEY missing");
  const fromEmail = Deno.env.get("EMAIL_FROM") || "notify@myagencybrain.com";
  
  const payload: any = {
    personalizations: [{ to: [{ email: msg.to }], subject: msg.subject }],
    from: { email: fromEmail, name: "AgencyBrain" },
    content: [{ type: "text/plain", value: msg.text }]
  };
  
  if (msg.html) payload.content.push({ type: "text/html", value: msg.html });
  if (msg.cc?.length) payload.personalizations[0].cc = msg.cc.map(e => ({ email: e }));
  
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { 
      "authorization": `Bearer ${apiKey}`, 
      "content-type": "application/json" 
    },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`SendGrid error ${res.status}: ${detail}`);
  }
}