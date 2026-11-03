# הגדרת SaaS — Firebase, מנוי חודשי ותשלומים (Grow דרך Make.com)

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

## 4. Grow דרך Make.com — תשלומים
כדי להימנע מהעלות החודשית של ה-API הישיר של Grow (500 ש"ח+מע"מ), יצירת דף
התשלום החד-פעמי עוברת דרך Make.com (בהתאם למה שתמיכת Grow המליצה) — בחינם.
קבלת ההתראה על תשלום שהושלם ממשיכה ישירות מ-Grow (זה לא היה חלק מהעלות
החודשית, רק יצירת הדף הדינמית).

### 4א. יצירת התרחיש (scenario) ב-Make.com
1. פותחים חשבון ב-make.com (יש תוכנית חינמית).
2. יוצרים תרחיש חדש עם:
   - **Trigger**: מודול "Webhooks" → "Custom webhook" → יוצרים webhook חדש,
     ומעתיקים את ה-URL שהוא מייצר.
   - **Action**: מחברים את אפליקציית **Grow** של Make ובוחרים את הפעולה
     ליצירת דף תשלום חד-פעמי מותאם אישית. ממפים את הסכום (`sum`) והתיאור
     (`description`) שהתקבלו מה-webhook. **חשוב**: לבדוק אם המודול הזה חושף
     שדות מותאמים אישית (custom fields / cField1-3) — אם כן, למפות
     `userId`→cField1, `heartsAdded`→cField2, `packageId`→cField3 (בדיוק
     כמו שהגיעו מה-webhook). בלי זה, ה-webhook הסופי מ-Grow לא ידע למי
     להפעיל את המנוי. (השם `heartsAdded` נשאר מהמודל הקודם כדי לא לשבור את
     המיפוי - היום הוא מכיל את מספר ימי המנוי, 30, ו-`packageId` הוא `monthly`.)
   - **Module אחרון**: "Webhooks" → "Webhook response" → מחזירים JSON:
     `{ "paymentUrl": <ה-URL של דף התשלום שנוצר> }`.
3. מפעילים את התרחיש (Scheduling → On), ומעתיקים את ה-webhook URL מהשלב 1
   ל-`.env.local` (ובהמשך Vercel): `MAKE_CHECKOUT_WEBHOOK_URL`.

אם המודול של Grow ב-Make **לא** תומך בשדות מותאמים אישית — יש לעדכן אותי,
כי אז `app/api/webhooks/grow/route.ts` צריך דרך אחרת לזהות מי שילם.

### 4ב. חיבור ה-Webhook הישיר מ-Grow (כמו קודם)
זה לא השתנה מהניסיון הקודם — בדף ה-Webhooks בפאנל הניהול של Grow (לא ב-Make):
- **לינק לעדכון השרת**: `https://mekapele.com/api/webhooks/grow`
- **סוג הוובהוק**: עדכון לאחר ביצוע עסקה
- **דיווחים**: כל העסקאות (לא כולל ריצות הוראת קבע)
- **צורת שליחת הנתונים**: JSON
- **סטטוס**: פעיל
- מעתיקים את ה-**webhook key** שמוצג בטופס ל-`GROW_WEBHOOK_KEY`. בלעדיו,
  ה-webhook נכשל במכוון (fail closed).

⚠️ **חשוב**: כל האינטגרציה הזו (`lib/payment/make.ts`,
`app/api/webhooks/grow/route.ts`) תלויה בתרחיש Make.com שאתם בונים בעצמכם —
אני לא יכול לבנות אותו (זו ממשק ויזואלי, לא קוד), רק להגדיר בדיוק מה הקוד
שלנו מצפה לקבל ולשלוח. לפני תשלום אמיתי, הריצו רכישת בדיקה אחת מקצה לקצה
ווודאו שה-webhook הסופי מ-Grow מגיע עם `customFields` תקינים.

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

## 7. מודל המנוי
- מנוי חודשי אחד (`lib/pricing.ts` → `MONTHLY_PLAN`): ₪50 ל-30 יום, תבניות ללא
  הגבלה. תשלום חד-פעמי, בלי הוראת קבע.
- הסטטוס נשמר ב-`subscriptions/{uid}.activeUntil` (epoch ms). האוסף הזה חסום
  לגמרי מהדפדפן (default deny) — רק השרת כותב/קורא, והדפדפן מקבל את הסטטוס
  מ-`GET /api/subscription`.
- `POST /api/generate` בודק שיש מנוי פעיל ומחזיר 402 (`SUBSCRIPTION_REQUIRED`)
  אם אין.
- רכישה: `create-checkout` שולח ל-Make סכום (אחרי קופון) + `heartsAdded`=30 +
  `packageId`=`monthly`. ה-webhook מ-Grow מאריך את המנוי אטומית: מסוף המנוי
  הנוכחי אם הוא עדיין פעיל, אחרת מעכשיו. רכישה בלי התחברות נשמרת
  ב-`pendingCredits` (עם `daysAdded`) ומופעלת בהתחברות הבאה עם אותו אימייל.
- `growProcessId` הוא מזהה מסמך העסקה, כך ש-webhook כפול לא מאריך פעמיים.
- חשבון הבעלים (lahavbarak430@gmail.com) תמיד מנוי פעיל, לבדיקות.

## הערה חשובה
לא יכולתי לבדוק את נתיב ה-Firebase, ה-Make.com או ה-Grow החי מהסביבה שלי כי
הם דורשים את המפתחות/התרחיש שלכם. מה שנבדק: ה-build עובר, האלגוריתם, אימות
ההעלאות, וה-rate limiting.
