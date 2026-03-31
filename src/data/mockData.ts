export const user = {
  firstName: "Alexandra",
  lastName: "Chen",
  preferredName: "Alex",
  email: "alex.chen@email.com",
  phone: "(415) 555-0142",
  avatar: null,
  memberSince: "January 2024",
  customerId: "GB-00284719",
  ssn: "***-**-4829",
  dob: "March 15, 1992",
  citizenship: "U.S. Citizen",
  occupation: "Product Designer",
  employer: "Figma, Inc.",
  income: "$100,000 – $149,999",
  address: {
    street: "1847 Pacific Avenue",
    apt: "Unit 12B",
    city: "San Francisco",
    state: "CA",
    zip: "94115",
    country: "United States",
  },
};

export const accounts = {
  checking: {
    id: "chk-001",
    name: "Everyday Checking",
    type: "checking" as const,
    accountNumber: "****4821",
    routingNumber: "021000089",
    availableBalance: 12847.63,
    currentBalance: 13102.63,
    pendingAmount: 255.0,
    status: "active",
    openedDate: "January 15, 2024",
  },
  savings: {
    id: "sav-001",
    name: "High Yield Savings",
    type: "savings" as const,
    accountNumber: "****7392",
    routingNumber: "021000089",
    availableBalance: 28450.0,
    currentBalance: 28450.0,
    pendingAmount: 0,
    apy: 4.25,
    interestEarned: 847.32,
    status: "active",
    openedDate: "January 15, 2024",
  },
};

export const totalBalance = accounts.checking.availableBalance + accounts.savings.availableBalance;

export type Transaction = {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  date: string;
  status: "posted" | "pending";
  type: "debit" | "credit";
  paymentMethod: string;
  icon: string;
  account: string;
};

export const transactions: Transaction[] = [
  { id: "t1", merchant: "Whole Foods Market", category: "Groceries", amount: -87.42, date: "Today, 2:34 PM", status: "pending", type: "debit", paymentMethod: "Debit Card", icon: "🛒", account: "Checking" },
  { id: "t2", merchant: "Spotify Premium", category: "Subscriptions", amount: -10.99, date: "Today, 12:00 AM", status: "posted", type: "debit", paymentMethod: "Debit Card", icon: "🎵", account: "Checking" },
  { id: "t3", merchant: "Direct Deposit — Figma Inc", category: "Income", amount: 4285.0, date: "Yesterday", status: "posted", type: "credit", paymentMethod: "ACH", icon: "💰", account: "Checking" },
  { id: "t4", merchant: "Blue Bottle Coffee", category: "Dining", amount: -6.75, date: "Yesterday", status: "posted", type: "debit", paymentMethod: "Debit Card", icon: "☕", account: "Checking" },
  { id: "t5", merchant: "Transfer to Savings", category: "Transfer", amount: -500.0, date: "Mar 28", status: "posted", type: "debit", paymentMethod: "Internal", icon: "↗️", account: "Checking" },
  { id: "t6", merchant: "Amazon.com", category: "Shopping", amount: -34.99, date: "Mar 27", status: "posted", type: "debit", paymentMethod: "Debit Card", icon: "📦", account: "Checking" },
  { id: "t7", merchant: "Uber", category: "Transportation", amount: -18.50, date: "Mar 27", status: "posted", type: "debit", paymentMethod: "Debit Card", icon: "🚗", account: "Checking" },
  { id: "t8", merchant: "Netflix", category: "Subscriptions", amount: -15.49, date: "Mar 26", status: "posted", type: "debit", paymentMethod: "Debit Card", icon: "🎬", account: "Checking" },
  { id: "t9", merchant: "Venmo — Sarah M.", category: "P2P", amount: 42.0, date: "Mar 26", status: "posted", type: "credit", paymentMethod: "P2P", icon: "👤", account: "Checking" },
  { id: "t10", merchant: "Trader Joe's", category: "Groceries", amount: -62.18, date: "Mar 25", status: "posted", type: "debit", paymentMethod: "Debit Card", icon: "🛒", account: "Checking" },
  { id: "t11", merchant: "Interest Payment", category: "Interest", amount: 98.42, date: "Mar 25", status: "posted", type: "credit", paymentMethod: "Interest", icon: "📈", account: "Savings" },
  { id: "t12", merchant: "PG&E Utilities", category: "Bills", amount: -142.30, date: "Mar 24", status: "posted", type: "debit", paymentMethod: "ACH", icon: "💡", account: "Checking" },
  { id: "t13", merchant: "Sweetgreen", category: "Dining", amount: -16.25, date: "Mar 24", status: "posted", type: "debit", paymentMethod: "Debit Card", icon: "🥗", account: "Checking" },
  { id: "t14", merchant: "Apple iCloud+", category: "Subscriptions", amount: -2.99, date: "Mar 23", status: "posted", type: "debit", paymentMethod: "Debit Card", icon: "☁️", account: "Checking" },
  { id: "t15", merchant: "Zelle — Mom", category: "P2P", amount: -200.0, date: "Mar 22", status: "posted", type: "debit", paymentMethod: "P2P", icon: "👤", account: "Checking" },
];

export const cardData = {
  nickname: "Glass Debit",
  last4: "4821",
  network: "Visa",
  type: "Debit",
  status: "active" as const,
  linkedAccount: "Everyday Checking",
  expiresAt: "08/28",
  isLocked: false,
  isVirtual: false,
};

export const savingsGoals = [
  { id: "g1", name: "Emergency Fund", target: 15000, current: 12400, icon: "🛡️", color: "primary" },
  { id: "g2", name: "Japan Trip", target: 5000, current: 2850, icon: "✈️", color: "info" },
  { id: "g3", name: "New MacBook", target: 3500, current: 1200, icon: "💻", color: "accent" },
];

export const insights = [
  { id: "i1", text: "You spent 18% more on dining this month", icon: "📊", type: "spending" },
  { id: "i2", text: "Your paycheck arrived — $4,285.00", icon: "🎉", type: "income" },
  { id: "i3", text: "2 subscriptions renew this week totaling $26.48", icon: "🔔", type: "alert" },
  { id: "i4", text: "You're 83% to your Emergency Fund goal", icon: "🎯", type: "savings" },
];

export const notifications = [
  { id: "n1", title: "Direct deposit received", body: "$4,285.00 from Figma Inc", time: "Yesterday", read: false, type: "deposit" },
  { id: "n2", title: "Card charged", body: "Whole Foods Market — $87.42", time: "2 hours ago", read: false, type: "card" },
  { id: "n3", title: "Transfer complete", body: "$500.00 moved to High Yield Savings", time: "Mar 28", read: true, type: "transfer" },
  { id: "n4", title: "Statement ready", body: "Your February statement is available", time: "Mar 1", read: true, type: "statement" },
  { id: "n5", title: "Savings milestone", body: "Emergency Fund is 83% funded!", time: "Mar 25", read: true, type: "savings" },
];

export const monthlySpending = {
  total: 2847.63,
  categories: [
    { name: "Groceries", amount: 412.80, percentage: 22, icon: "🛒" },
    { name: "Dining", amount: 287.50, percentage: 15, icon: "🍽️" },
    { name: "Subscriptions", amount: 89.47, percentage: 5, icon: "📱" },
    { name: "Transportation", amount: 245.00, percentage: 13, icon: "🚗" },
    { name: "Shopping", amount: 534.99, percentage: 19, icon: "🛍️" },
    { name: "Bills", amount: 842.30, percentage: 26, icon: "💡" },
  ],
};

export const cashFlow = {
  moneyIn: 8570.00,
  moneyOut: 5722.37,
  savingsChange: 500.00,
  upcomingBills: 3,
  subscriptionTotal: 89.47,
};

export const recentRecipients = [
  { id: "r1", name: "Sarah M.", initial: "S", lastSent: "$42.00" },
  { id: "r2", name: "Mom", initial: "M", lastSent: "$200.00" },
  { id: "r3", name: "James K.", initial: "J", lastSent: "$85.00" },
  { id: "r4", name: "Lisa T.", initial: "L", lastSent: "$25.00" },
];

export const faqData = [
  {
    category: "Account",
    items: [
      { q: "How do I open an account?", a: "Download the Glass Bank app and tap 'Open an Account.' You'll need a valid government ID, your Social Security number, and a U.S. address. The process takes about 5 minutes." },
      { q: "What do I need to verify my identity?", a: "We require a government-issued photo ID (driver's license, passport, or state ID) and your Social Security number. We may also ask for a selfie to verify your identity." },
      { q: "Can I have both checking and savings?", a: "Yes! You can open an Everyday Checking account, a High Yield Savings account, or both during the signup process." },
      { q: "How long does approval take?", a: "Most accounts are approved instantly. In some cases, additional verification may take 1–2 business days." },
    ],
  },
  {
    category: "Login & Security",
    items: [
      { q: "How do I reset my password?", a: "Tap 'Forgot Password' on the login screen. We'll send a secure reset link to your registered email address." },
      { q: "How do I enable Face ID / fingerprint login?", a: "Go to Profile → Security Center → Biometric Login and toggle it on. You'll need to verify with your password first." },
      { q: "What if I lose my phone?", a: "Contact us immediately at 1-800-GLASS-BK. We'll lock your app access and help you regain access on a new device." },
      { q: "How does account security work?", a: "We use bank-level 256-bit encryption, biometric authentication, real-time fraud monitoring, and FDIC insurance up to $250,000." },
    ],
  },
  {
    category: "Direct Deposit",
    items: [
      { q: "How do I set up direct deposit?", a: "Go to Home → Direct Deposit section. You'll find your account and routing numbers, and you can share or download a pre-filled direct deposit form." },
      { q: "Where do I find my routing and account number?", a: "Tap on your account card on the Home screen, then go to Details. Your routing number is 021000089." },
      { q: "When does direct deposit arrive?", a: "Glass Bank offers early direct deposit — you can receive your paycheck up to 2 days early when your employer sends it via ACH." },
    ],
  },
  {
    category: "Mobile Check Deposit",
    items: [
      { q: "How do I deposit a check?", a: "Tap Move Money → Deposit Check. Select your account, endorse the check with 'For mobile deposit only,' and take photos of the front and back." },
      { q: "When will my funds be available?", a: "The first $225 is typically available by the next business day. The remainder is usually available within 2 business days." },
      { q: "Why was my check rejected?", a: "Common reasons include poor image quality, missing endorsement, check already deposited, or the check exceeding your deposit limit." },
    ],
  },
  {
    category: "Transfers & Payments",
    items: [
      { q: "How do I send money?", a: "Go to Move Money → Send Money. Enter the recipient's email or phone number, the amount, and confirm. Funds are typically available within minutes." },
      { q: "How long do transfers take?", a: "Internal transfers are instant. External ACH transfers take 1–3 business days. Wire transfers are same-day if initiated before 4:00 PM ET." },
      { q: "What are transfer cut-off times?", a: "ACH: 8:00 PM ET for next-day processing. Wires: 4:00 PM ET for same-day processing. Internal: processed instantly 24/7." },
    ],
  },
  {
    category: "Cards",
    items: [
      { q: "How do I lock my card?", a: "Go to the Cards tab and tap 'Lock Card.' Your card will be instantly locked and no new transactions will be approved until you unlock it." },
      { q: "How do I replace a lost card?", a: "Go to Cards → Replace Card. Your old card will be deactivated and a new card will be mailed within 5–7 business days. You can also request expedited delivery." },
      { q: "How do disputes work?", a: "Tap on the disputed transaction and select 'Dispute Charge.' We'll investigate within 10 business days and provide provisional credit if applicable." },
    ],
  },
];
