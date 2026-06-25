# הגדרת SaaS — Firebase, אבטחה ותשלומים

המסמך הזה מסביר מה צריך להגדיר כדי שהאתר יעבוד עם התחברות, מסד נתונים וגידור תשלום.
**הקוד כולו כתוב ומוכן — חסר רק לחבר מפתחות משלך.**

## 1. יצירת פרויקט Firebase
1. היכנסו ל-https://console.firebase.google.com → "Add project".
2. הפעילו **Authentication** → Sign-in method → **Google** (זו השיטה היחידה שהאתר תומך בה).
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

## 4. הגדרת משתני הסביבה ב-Vercel
ב-Vercel → Project → Settings → **Environment Variables** → הוסיפו את **כל** המשתנים
מ-`.env.local` (גם הפומביים וגם הסודיים). הגדירו `NEXT_PUBLIC_SITE_ORIGIN` ל-`https://mekapele.com`.

## 5. פרסום חוקי האבטחה
הקובץ `firestore.rules` חייב להיות פעיל ב-Firebase, אחרת המסד פתוח.
- דרך ה-CLI: `firebase deploy --only firestore:rules`
- או: Console → Firestore → Rules → הדביקו את התוכן → Publish.

החוקים מבטיחים: כל משתמש קורא/כותב רק את המסמכים שלו, ושדות `credits` ו-`subscriptionTier`
**לא ניתנים לכתיבה מהלקוח** — רק השרת (Admin SDK) או ה-webhook יכולים לשנות אותם.

## 6. ארכיטקטורת האבטחה (מה כבר מיושם)
- **עיבוד בשרת**: המדידות המדויקות נוצרות רק ב-`/api/generate` עם `sharp`, אחרי אימות
  טוקן + צריכת קרדיט. הדפדפן מקבל רק תצוגה מקדימה ברזולוציה נמוכה. כך הגידור באמת אכיף.
- **אימות העלאות** (`lib/security/validateUpload.ts`): בודק MIME, גודל (מקס׳ 5MB), וחתימת
  bytes אמיתית — קובץ הרצה מחופש לתמונה נחסם.
- **Rate limiting** (`lib/security/rateLimit.ts` + `middleware.ts`): הגבלת קצב לכל משתמש/IP.
  להרחבה לפרודקשן רב-שרתי, יש להחליף את ה-store בזיכרון ב-Redis/Vercel KV.
- **CORS** (`lib/security/cors.ts`): מאפשר בקשות רק מהדומיין שב-`NEXT_PUBLIC_SITE_ORIGIN`.
- **Webhook לתשלום** (`app/api/webhooks/payment/route.ts`): כולל אימות חתימה קריפטוגרפית
  (סגנון Stripe) עם הגנת replay. צריך להגדיר `PAYMENT_WEBHOOK_SECRET` כשמחברים תשלום.

## 7. מודל הקרדיטים
- משתמש חדש מקבל 3 קרדיטים חינם (ב-`ensureUserProfile`).
- כל יצירת תבנית מדויקת צורכת קרדיט אחד (אטומי, עם החזר אם העיבוד נכשל).
- חיבור Stripe/PayPal עתידי: ה-webhook כבר מזרים קרדיטים דרך `grantCredits`. צריך רק למפות
  מוצר→כמות קרדיטים, ולגדר את "ייצוא PDF" / "מעקב אינטראקטיבי" באותו אופן אם תרצו.

## הערה חשובה
לא יכולתי לבדוק את נתיב ה-Firebase החי מהסביבה שלי כי הוא דורש את המפתחות שלכם.
מה שנבדק ואומת: ה-build עובר, האלגוריתם, אימות ההעלאות, וה-rate limiting. החיבור החי
ל-Google login ו-Firestore יתחיל לעבוד ברגע שתמלאו את משתני הסביבה.
