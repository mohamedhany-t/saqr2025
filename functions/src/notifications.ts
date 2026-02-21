import * as admin from "firebase-admin";

export async function sendNotificationToUser(userId: string, title: string, body: string, url?: string) {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const tokens = userData?.fcmTokens || [];

    if (tokens.length === 0) return;

    const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
            title,
            body,
        },
        data: url ? { url } : {},
        webpush: {
            fcmOptions: {
                link: url || '/',
            },
        },
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`Successfully sent notification to user ${userId}: ${response.successCount} messages sent.`);
        
        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            
            if (failedTokens.length > 0) {
                await admin.firestore().collection('users').doc(userId).update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens)
                });
            }
        }
    } catch (error) {
        console.error('Error sending multicast message:', error);
    }
}
