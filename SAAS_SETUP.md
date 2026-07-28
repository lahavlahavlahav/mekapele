# הגדרת SaaS — Firebase, לבבות ותשלומים (Grow)

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

## 4. Grow (Meshulam) — תשלומים
1. פנו לתמיכה של Grow (https://grow.business) לקבלת חשבון + `pageCode` + `userId`.
2. מלאו ב-`.env.local`: `GROW_PAGE_CODE`, `GROW_USER_ID`.
3. השאירו `GROW_API_BASE` מכוון לסביבת ה-sandbox עד שתאמתו עסקה אמיתית שם, ורק
   אז עברו לסביבת הפרודקשן (מוזכר כהערה ב-`.env.local.example`).

⚠️ **חשוב**: אינטגרציית Grow (`lib/payment/grow.ts`, `app/api/webhooks/grow/route.ts`)
נכתבה לפי התיעוד הרשמי של Grow, אך **לא נבדקה מול חשבון Grow אמיתי** (לא היו זמינים
פרטי התחברות בזמן הפיתוח). לפני קבלת תשלומים אמיתיים:
- הריצו עסקת בדיקה אחת בסביבת ה-sandbox ובדקו את התשובה בפועל מ-`createPaymentProcess`
  ואת ה-payload שמתקבל ב-webhook — ודאו ששמות השדות תואמים למה שהקוד מצפה לו.
- שימו לב במיוחד לפורמט הבקשה (form-urlencoded לעומת JSON) ולפרמטרים של
  `approveTransaction`, שלא היו מפורטים במלואם בתיעוד הפומבי.

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
- זרימת תשלום: `POST /api/payment/create-checkout` יוצר תהליך תשלום ב-Grow ורשומת
  `transactions/{id}` במצב `pending`. אחרי תשלום מוצלח, Grow קורא ל-
  `POST /api/webhooks/grow`, שמעדכן את הרשומה ל-`completed` ומזרים לבבות
  אטומית (`FieldValue.increment`) — הכל בטרנזקציה אחת, כך שקריאת webhook כפולה
  לא תזכה פעמיים.

## הערה חשובה
לא יכולתי לבדוק את נתיב ה-Firebase או ה-Grow החי מהסביבה שלי כי הם דורשים את
המפתחות שלכם. מה שנבדק: ה-build עובר, האלגוריתם, אימות ההעלאות, וה-rate limiting.
