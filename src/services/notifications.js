import { LocalNotifications } from "@capacitor/local-notifications";

export const notificationService = {
  async init() {
    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== "granted") {
        await LocalNotifications.requestPermissions();
      }
    } catch (e) {
      console.warn("LocalNotifications not supported or permission denied", e);
    }
  },

  async scheduleStatusCheck(reportId, categoryName, hoursDelay = 2, lang = "ar") {
    try {
      // Ensure we request permissions first
      await this.init();

      // Convert hours to milliseconds
      const triggerTime = Date.now() + hoursDelay * 3600 * 1000;

      const title = lang === "ar" ? "تحديث حالة بلاغك" : "Update Your Report Status";
      const body = lang === "ar"
        ? `هل تم حل مشكلة "${categoryName}"؟ اضغط هنا لتأكيد حالة البلاغ.`
        : `Has the issue "${categoryName}" been solved? Tap here to update status.`;

      // Simple hash to convert string ID to a numeric ID for Capacitor
      let numericId = 1;
      if (reportId) {
        let hash = 0;
        for (let i = 0; i < reportId.length; i++) {
          hash = reportId.charCodeAt(i) + ((hash << 5) - hash);
        }
        numericId = Math.abs(hash);
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: numericId,
            schedule: { at: new Date(triggerTime) },
            extra: { reportId }
          }
        ]
      });
      console.log(`Scheduled native local notification for report ${reportId} in ${hoursDelay} hours`);
    } catch (e) {
      console.warn("Failed to schedule local notification", e);
    }
  }
};
