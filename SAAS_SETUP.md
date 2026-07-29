# הגדרת SaaS — Firebase, לבבות ותשלומים (Stripe)

המסמך הזה מסביר מה צריך להגדיר כדי שהאתר יעבוד עם התחברות, מסד נתונים ותשלומים אמיתיים.
**הקוד כולו כתוב ומוכן — חסר רק לחבר מפתחות משלכם.**

## 1. יצירת פרויקט Firebase
1. היכנסו ל-https://console.firebase.google.com → "Add project".
2. הפעילו **Authentication** → Sign-in method → **Google** וגם **Email/Password**.
3. הפעילו **Firestore Database** (מצב Production).

## 2. מפתחות לצד הלקוח (פומביים — בטוחים בדפדפן)
ב-Firebase Console → Project settings → "Your apps" → Web app → העתיקו את ה-config.
מלאו ב-`.env.local` (העתיקו מ-`.env.local.example`) את כל ה-`NEXT_PUBLIC_FIREBASE_*`.

## 3. מפתח Admin (סודי — שרת בלבד!)
Project settings → **Service accounts** → "Generate new private key" → יורד קובץ JSON.
מתוכו העתיקו ל-`.env.local`:
- `FIREBASE_ADMIN_PROJECT_ID` ← `project_id`
- `FIREBASE_ADMIN_CLIENT_EMAIL` ← `client_email`
- `FIREBASE_ADMIN_PRIVATE_KEY` ← `private_key` (כולל ה-`\n`, בתוך מרכאות)

⚠️ אסור בשום אופן לחשוף את המפתח הזה בצד הלקוח או לדחוף אותו ל-GitHub.

## 4. Stripe — תשלומים
1. פתחו חשבון ב-https://dashboard.stripe.com (אם עוד אין לכם), עם עסק ישראלי —
   Stripe תומכת בהעברות ל-IBAN ישראלי ובכרטיסי אשראי, ללא עלות חודשית קבועה
   (רק עמלה לכל עסקה).
2. **Developers → API keys**: העתיקו את ה-**Secret key**. בהתחלה משתמשים במפתח
   שמתחיל ב-`sk_test_...` (מצב בדיקות, בלי כסף אמיתי) — רק אחרי שמוודאים רכישה
   מלאה עוברת כמו שצריך, עוברים ל-`sk_live_...`. מלאו ב-`.env.local`
   (ובהמשך ב-Vercel): `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**:
   - **Endpoint URL**: `https://mekapele.com/api/webhooks/stripe`
   - **Events to send**: `checkout.session.completed`
   - אחרי היצירה, לוחצים על ה-endpoint ומגלים ("Reveal") את ה-**Signing secret**
     (`whsec_...`) — זה הולך ל-`STRIPE_WEBHOOK_SECRET`. בלעדיו, ה-webhook נכשל
     במכוון (fail closed), וגם בקשה עם חתימה שגויה נדחית — כך שאף אחד לא יכול
     לקרוא ל-URL הפומבי הזה ולזכות לבבות לעצמו בלי לשלם.
4. **לבדיקה מקומית** לפני שיש דומיין: Stripe CLI (`stripe listen --forward-to
   localhost:3000/api/webhooks/stripe`) מדפיס signing secret זמני לבדיקות.

Stripe הוא ה-SDK הרשמי והמתועד היטב — האינטגרציה כאן (`lib/payment/stripe.ts`,
`app/api/webhooks/stripe/route.ts`) משתמשת בו ישירות (לא בקריאות HTTP ידניות),
כולל אימות חתימה מובנה (`stripe.webhooks.constructEvent`). עדיין לא בוצעה כאן
עסקת בדיקה אמיתית (אין מפתחות בסביבה הזו) — מומלץ לבצע רכישה אחת ב-מצב
test לפני מעבר ל-production.

## 5. הגדרת משתני הסביבה ב-Vercel
ב-Vercel → Project → Settings → **Environment Variables** → הוסיפו את **כל** המשתנים
מ-`.env.local` (גם הפומביים וגם הסודיים). הגדירו `NEXT_PUBLIC_SITE_ORIGIN` ל-`https://mekapele.com`.

## 6. פרסום חוקי האבטחה
הקובץ `firestore.rules` חייב להיות פעיל ב-Firebase, אחרת המסד פתוח.
- דרך ה-CLI: `firebase deploy --only firestore:rules`
- או: Console → Firestore → Rules → הדביקו את התוכן → Publish.

החוקים מבטיחים: כל משתמש קורא/כותב רק את המסמכים שלו, שדה `hearts` **לא ניתן
לכתיבה מהלקוח** (רק Admin SDK), ואוסף `transactions` ניתן לקריאה בלבד לבעל הרשומה
ואף פעם לא לכתיבה מהלקוח.

## 7. מודל הלבבות
- משתמש חדש מתחיל עם **0 לבבות** (`users/{userId}.hearts`, ב-`ensureUserProfile`).
- כל בקשת יצירה מחשבת את מספר הקיפולים בפועל בשרת (`app/api/generate`):
  עד 500 קיפולים = תבנית פשוטה = לב 1; מעל 500 = תבנית מורכבת = 2 לבבות.
  החיוב אטומי (טרנזקציית Firestore) ומבוסס על המספר האמיתי שהשרת חישב — לא על
  מה שהלקוח טוען.
- חבילות רכישה (`lib/pricing.ts`): 1 לב = ₪19, 5 לבבות = ₪75 (הכי משתלם),
  10 לבבות = ₪150.
- זרימת תשלום, מופרדת לשני קבצים באחריות ברורה:
  - `POST /api/payment/create-checkout` — אחראי **רק** על הבקשה ל-Stripe (יצירת
    Checkout Session) והחזרת ה-URL ללקוח. לא נוגע ב-Firestore בכלל.
  - `POST /api/webhooks/stripe` — אחראי על אימות החתימה, קבלת ה-webhook, בדיקת
    ה-idempotency, ויצירת/עדכון ה-Firestore. כשתשלום מאושר (`checkout.session.completed`),
    הוא יוצר את `transactions/{stripeSessionId}` (עם ה-id של ה-Checkout Session
    עצמו כמזהה המסמך) ומזרים לבבות אטומית (`FieldValue.increment`) — הכל באותה
    טרנזקציית Firestore, כך שאם Stripe שולח את אותו webhook פעמיים (ה-retry
    המובנה שלה בכל תשובה שאינה 2xx), הכתיבה השנייה היא no-op ולא תזכה פעמיים.

## הערה חשובה
לא יכולתי לבדוק את נתיב ה-Firebase או ה-Stripe החי מהסביבה שלי כי הם דורשים את
המפתחות שלכם. מה שנבדק: ה-build עובר, האלגוריתם, אימות ההעלאות, וה-rate limiting.
