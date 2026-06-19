export function getDeviceFingerprint() {
  let fingerprint = localStorage.getItem("libya_report_device_id");
  if (!fingerprint) {
    // Generate a secure pseudo-random unique ID
    const array = new Uint32Array(4);
    window.crypto.getRandomValues(array);
    let uuid = "";
    for (let i = 0; i < array.length; i++) {
      uuid += array[i].toString(16).padStart(8, "0");
    }
    // Mix in user agent hash for light fingerprinting context
    const ua = navigator.userAgent;
    let uaHash = 0;
    for (let i = 0; i < ua.length; i++) {
      uaHash = (uaHash << 5) - uaHash + ua.charCodeAt(i);
      uaHash |= 0;
    }
    fingerprint = `dev_${uuid}_${Math.abs(uaHash).toString(16)}`;
    localStorage.setItem("libya_report_device_id", fingerprint);
  }
  return fingerprint;
}
export function getUserScore() {
  const score = localStorage.getItem("libya_report_user_score");
  return score ? parseInt(score, 10) : 0;
}

export function addUserScore(points) {
  const current = getUserScore();
  const next = current + points;
  localStorage.setItem("libya_report_user_score", next.toString());
  return next;
}

export function getUserBadges(score) {
  const badges = [];
  if (score >= 10) badges.push("activeCitizen");
  if (score >= 40) badges.push("communityHero");
  if (score >= 100) badges.push("civicLeader");
  return badges;
}

export function getHardwareId() {
  return localStorage.getItem("libya_report_hardware_id") || "WEB_" + getDeviceFingerprint().substring(4, 16).toUpperCase();
}
