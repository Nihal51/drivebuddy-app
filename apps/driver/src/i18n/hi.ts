/** The Driver app in Hindi: the same keys as en.ts. */

import type { Messages } from './en';

export const hi: Messages = {
  appName: 'DriveBuddy ड्राइवर',
  languageName: 'हिंदी',

  login: {
    title: 'ड्राइवर लॉगिन',
    subtitle: 'DriveBuddy ड्राइवरों के लिए। वही मोबाइल नंबर डालें जो आपने ऑफ़िस को दिया है।',
    phoneLabel: 'मोबाइल नंबर',
    phonePlaceholder: '98765 43210',
    sendCode: 'कोड भेजें',
    codeTitle: (phone) => `${phone} पर भेजा गया कोड डालें`,
    codeLabel: 'SMS वाला कोड',
    verify: 'लॉगिन करें',
    changeNumber: 'नंबर बदलें',
    codesLeft: (n) => `आज ${n} और कोड भेजे जा सकते हैं।`,
    errors: {
      'bad-phone': 'कृपया 10 अंकों का मोबाइल नंबर डालें।',
      'not-a-driver':
        'यह नंबर किसी DriveBuddy ड्राइवर के रिकॉर्ड में नहीं है। जुड़ने के लिए ऑफ़िस को कॉल करें।',
      limit: (at) => `इस नंबर पर 24 घंटे में 3 कोड भेजे जा चुके हैं। ${at} के बाद फिर कोशिश करें।`,
      busy: 'अभी लॉगिन व्यस्त है। कुछ मिनट बाद कोशिश करें, या ऑफ़िस को कॉल करें।',
      'sms-failed': 'SMS नहीं भेजा जा सका। एक मिनट बाद फिर कोशिश करें।',
      'not-configured': 'ड्राइवर लॉगिन अभी चालू नहीं है। कृपया ऑफ़िस को कॉल करें।',
      'wrong-code': (left) => `कोड सही नहीं है। ${left} कोशिश बाकी।`,
      expired: 'यह कोड पुराना हो गया है। नया कोड मँगाएँ।',
      'too-many-tries': 'बहुत बार गलत कोड डाला गया। नया कोड मँगाएँ।',
      network: 'इंटरनेट नहीं है। कनेक्शन देखकर फिर कोशिश करें।',
      unavailable: 'कुछ गड़बड़ हो गई। फिर कोशिश करें, या ऑफ़िस को कॉल करें।',
    },
  },

  jobs: {
    title: 'मेरे काम',
    hello: (name) => `नमस्ते, ${name}`,
    empty: 'अभी कोई काम नहीं',
    emptyBody: 'जब ऑफ़िस आपको कोई बुकिंग देगा, वह यहाँ अपने आप दिखेगी।',
    sharing: 'लोकेशन शेयर हो रही है',
    asap: 'जितनी जल्दी हो सके',
    callOffice: 'ऑफ़िस को कॉल',
    logout: 'लॉग आउट',
    logoutConfirm: 'DriveBuddy ड्राइवर से लॉग आउट करें?',
    cancel: 'रहने दें',
    loadFailed: 'आपके काम लोड नहीं हुए। फिर कोशिश के लिए नीचे खींचें।',
    stillSharing: 'आप ऐसे काम पर लोकेशन शेयर कर रहे थे जो अब आपका नहीं है। शेयरिंग बंद कर दी गई है।',
  },

  offers: {
    title: 'नए काम के ऑफ़र',
    youEarn: (amount) => `आपकी कमाई ${amount}`,
    accept: 'काम लें',
    acceptTitle: 'यह काम लेना है?',
    acceptBody: (amount) => `आपकी कमाई ${amount}। काम लेते ही ग्राहक की जानकारी "मेरे काम" में दिखेगी।`,
    gone: 'यह काम किसी दूसरे ड्राइवर ने पहले ले लिया।',
    failed: 'काम नहीं लिया जा सका। इंटरनेट देखकर फिर कोशिश करें।',
    accepted: 'काम आपका हो गया। अब यह "मेरे काम" में है।',
    notActive: 'ऑफ़िस आपको Active करेगा, तब काम के ऑफ़र यहाँ दिखेंगे।',
  },

  earnings: {
    open: 'मेरी कमाई',
    title: 'मेरी कमाई',
    owed: 'DriveBuddy पर आपका बाकी',
    upcoming: 'काम के बाद',
    paid: 'आपको दिया गया',
    empty: 'ऑफ़र से लिए गए काम और उनकी कमाई यहाँ दिखेगी।',
    statusOwed: 'देना बाकी',
    statusUpcoming: 'काम अभी पूरा नहीं',
    statusPaid: (date) => `दिया गया ${date}`,
    note: 'हर पूरे हुए काम के बाद DriveBuddy आपका हिस्सा देता है।',
  },

  job: {
    title: 'काम',
    gone: 'यह काम अब आपको नहीं दिया गया है।',
    back: 'मेरे काम पर वापस',
    customer: 'ग्राहक',
    call: 'कॉल',
    pickup: 'पिकअप',
    navigate: 'रास्ता देखें',
    when: 'कब',
    service: 'सेवा',
    tripTo: (to) => `${to} की ट्रिप`,
    notes: 'नोट्स',
    start: 'शुरू करें — मेरी लोकेशन शेयर करें',
    startHint: 'पिकअप के लिए निकलते समय दबाएँ। ग्राहक आपको मैप पर देखेगा।',
    arrived: 'पहुँच गया — शेयरिंग बंद करें',
    sharingNow: 'आपकी लाइव लोकेशन ग्राहक के साथ शेयर हो रही है',
    sharingNote: 'ऐप खुला रखें या बैकग्राउंड में रहने दें। शेयरिंग के दौरान एक नोटिफ़िकेशन दिखता रहेगा।',
    lastSent: (time) => `आख़िरी बार भेजी ${time}`,
    permissionDenied:
      'लोकेशन शेयर करने के लिए लोकेशन की अनुमति चाहिए। Settings → Apps → DriveBuddy Driver में अनुमति दें।',
    openSettings: 'Settings खोलें',
    gpsOff: 'आपका GPS बंद है। Location चालू करके फिर कोशिश करें।',
    startFailed: 'शेयरिंग शुरू नहीं हो सकी। फिर कोशिश करें।',
    otherJobSharing: 'आप पहले से किसी दूसरे काम पर शेयर कर रहे हैं। पहले वहाँ "पहुँच गया" दबाएँ।',
    notificationTitle: 'DriveBuddy ड्राइवर',
    notificationBody: 'आपकी लोकेशन ग्राहक के साथ शेयर हो रही है',
  },

  packages: {
    '1-hour-300': '1 घंटा',
    '3-hours-600': '3 घंटे',
    'local-full-day': 'शहर में पूरा दिन',
    outstation: 'आउटस्टेशन ट्रिप',
    'night-driver': 'रात का ड्राइवर',
    'medical-emergency': 'अस्पताल / इमरजेंसी',
    'monthly-basic': 'मंथली ड्राइवर — बेसिक',
    'monthly-premium': 'मंथली ड्राइवर — प्रीमियम',
    'wedding-event': 'शादी / इवेंट',
    'one-way-drop': 'वन-वे कार ड्रॉप',
  },
  unknownPackage: 'ड्राइवर बुकिंग',

  dates: {
    weekdays: ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'],
    months: ['जन॰', 'फ़र॰', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अग॰', 'सित॰', 'अक्टू॰', 'नव॰', 'दिस॰'],
    time: (hour, clock) => {
      const part = hour < 4 ? 'रात' : hour < 12 ? 'सुबह' : hour < 16 ? 'दोपहर' : hour < 20 ? 'शाम' : 'रात';
      return `${part} ${clock}`;
    },
    day: (weekday, day, month) => `${weekday}, ${day} ${month}`,
    dateTime: (date, time) => `${date}, ${time}`,
    today: 'आज',
  },
};
