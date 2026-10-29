/**
 * हिंदी — every line of en.ts, in the same order. Typed as `Messages`, so a
 * missing or extra line fails `npm run typecheck`. Wording follows the
 * website's Hindi pages (lib/content-hi.ts there).
 */

import type { Messages } from './en';

export const hi: Messages = {
  locale: 'hi-IN',
  languageName: 'हिंदी',

  common: {
    appName: 'DriveBuddy',
    call: 'कॉल करें',
    whatsapp: 'WhatsApp',
    email: 'ईमेल',
    book: 'बुक करें',
    bookDriver: 'ड्राइवर बुक करें',
    retry: 'फिर से कोशिश करें',
    save: 'सेव करें',
    saved: 'सेव हो गया',
    cancel: 'रद्द करें',
    done: 'ठीक है',
    back: 'वापस',
    optional: 'ज़रूरी नहीं',
    loading: 'लोड हो रहा है…',
    offline: 'आप ऑफ़लाइन हैं। दिखाई गई कीमतें पिछली बार लोड की गई हैं।',
  },

  tabs: {
    home: 'होम',
    bookings: 'मेरी बुकिंग',
    account: 'अकाउंट',
  },

  cities: { Raipur: 'रायपुर', Bhilai: 'भिलाई', Durg: 'दुर्ग', Bilaspur: 'बिलासपुर' },

  home: {
    greeting: (name: string) => `नमस्ते, ${name}`,
    welcome: 'DriveBuddy में आपका स्वागत है',
    title: 'आपका ड्राइवर, 30 मिनट में आपके दरवाज़े पर',
    badges: { verified: 'वेरिफ़ाइड', sober: 'शराब नहीं', experienced: '5+ साल' },
    moreServices: 'और सेवाएँ',
    helpTitle: 'सीधे बात करना चाहते हैं?',
    helpBody: 'कॉल या WhatsApp करें — हम 24/7 जवाब देते हैं।',
  },

  categories: {
    hourly: { name: 'घंटे के हिसाब से', blurb: '1 या 3 घंटे' },
    day: { name: 'पूरा दिन', blurb: 'शहर में 8 घंटे' },
    drop: { name: 'दूसरे शहर ड्रॉप', blurb: 'एक तरफ़, आपकी कार' },
    outstation: { name: 'आउटस्टेशन', blurb: 'जाना और लौटना' },
    night: { name: 'रात का ड्राइवर', blurb: 'रात 8 – सुबह 6' },
    monthly: { name: 'मंथली ड्राइवर', blurb: 'आपका अपना ड्राइवर' },
    wedding: { name: 'शादी / इवेंट', blurb: 'पूरे इवेंट के लिए' },
    hospital: { name: 'अस्पताल', blurb: 'हम पहले कॉल करते हैं' },
  },

  wizard: {
    step: (n: number, total: number) => `चरण ${n} / ${total}`,
    steps: ['सेवा', 'पिकअप और समय', 'पुष्टि'] as [string, string, string],
    serviceTitle: 'आपको क्या चाहिए?',
    optionsTitle: 'एक चुनें',
    allServices: 'सभी सेवाएँ',
    whereTitle: 'कहाँ और कब?',
    confirmTitle: 'देखें और बुक करें',
    continue: 'आगे बढ़ें',
    back: 'पीछे',
    change: 'बदलें',
    service: 'सेवा',
    price: 'कीमत',
    estimate: 'अनुमान',
    yourDetails: 'आपकी जानकारी',
  },

  packages: {
    '1-hour-300': { name: '1 घंटा', blurb: 'मीटिंग, कोई काम, अस्पताल का छोटा चक्कर' },
    '3-hours-600': { name: '3 घंटे', blurb: 'शॉपिंग, रिश्तेदारों से मिलना, एयरपोर्ट' },
    'local-full-day': { name: 'शहर में पूरा दिन', blurb: 'आपके शहर में 8 घंटे की ड्राइविंग' },
    outstation: { name: 'आउटस्टेशन ट्रिप', blurb: 'आपकी कार में शहर से बाहर, प्रति दिन' },
    'night-driver': {
      name: 'रात का ड्राइवर',
      blurb: 'रात 8 से सुबह 6 बजे तक, पार्टी और देर से लौटने के लिए',
    },
    'medical-emergency': {
      name: 'अस्पताल / इमरजेंसी',
      blurb: 'प्राथमिकता से बुकिंग — हम सबसे पहले कॉल करते हैं',
    },
    'monthly-basic': { name: 'मंथली ड्राइवर — बेसिक', blurb: 'हर महीने आपका अपना नियमित ड्राइवर' },
    'monthly-premium': {
      name: 'मंथली ड्राइवर — प्रीमियम',
      blurb: 'कम जॉइनिंग फ़ीस, ड्राइवर छुट्टी पर हो तो दूसरा ड्राइवर मुफ़्त',
    },
    'wedding-event': { name: 'शादी / इवेंट', blurb: 'पूरे इवेंट के लिए ड्राइवर, या ड्राइवर के साथ गाड़ियाँ' },
    'one-way-drop': { name: 'वन-वे कार ड्रॉप', blurb: 'आपकी कार दूसरे शहर तक, प्रति दिन के हिसाब से' },
  },
  unknownPackage: 'ड्राइवर बुकिंग',
  popular: 'सबसे लोकप्रिय',

  price: {
    from: (amount: string) => `${amount} से`,
    monthly: (amount: string) => `${amount}/माह`,
    perDay: (amount: string) => `${amount}/दिन`,
    monthlyFrom: (amount: string) => `${amount}/माह से`,
    priority: 'प्राथमिकता',
    quote: 'कॉल पर कीमत',
  },

  pillars: [
    {
      icon: 'shield-checkmark',
      title: 'पुलिस वेरिफ़िकेशन',
      body: 'हर ड्राइवर का पहचान पत्र और पुलिस बैकग्राउंड चेक।',
    },
    { icon: 'ban', title: 'शराब पर पूरी रोक', body: 'हर शिफ़्ट से पहले ब्रेथ एनालाइज़र टेस्ट।' },
    { icon: 'ribbon', title: 'प्रोफ़ेशनल ट्रेनिंग', body: 'डिफ़ेंसिव ड्राइविंग, फ़र्स्ट एड और ग्राहक सेवा।' },
    { icon: 'time', title: '5+ साल का अनुभव', body: 'हर ड्राइवर को कम से कम पाँच साल का अनुभव।' },
  ],

  book: {
    title: 'ड्राइवर बुक करें',
    lede: 'यह फ़ॉर्म भरें — हम कुछ ही मिनट में कॉल करके आपका ड्राइवर कन्फ़र्म करेंगे।',
    loggedInAs: (name: string) => `${name} के नाम से बुकिंग। यह “मेरी बुकिंग” में दिखेगी।`,
    loginHint: 'लॉग इन करें, ताकि बुकिंग ट्रैक कर सकें और ड्राइवर तय होते ही सूचना मिले।',
    loginLink: 'लॉग इन',
    name: 'आपका नाम',
    namePlaceholder: 'पूरा नाम',
    phone: 'मोबाइल नंबर',
    phonePlaceholder: '10 अंकों का मोबाइल नंबर',
    city: 'शहर',
    service: 'सेवा',
    pickup: 'पिकअप का पता',
    pickupPlaceholder: 'मकान / गली, इलाका, लैंडमार्क',
    when: 'कब',
    asap: 'जितनी जल्दी हो सके',
    schedule: 'समय चुनें',
    today: 'आज',
    tomorrow: 'कल',
    noSlotsToday: 'आज के स्लॉट ख़त्म — कल चुनें, या “जितनी जल्दी हो सके” चुनें।',
    notes: 'और कुछ?',
    notesPlaceholder: 'कार का मॉडल, कहाँ जाना है, कितने घंटे…',
    submit: 'ड्राइवर बुक करें',
    submitting: 'बुक हो रहा है…',
    fixErrors: 'कृपया लाल रंग वाले फ़ील्ड देखें।',
    disclaimer: 'अभी कोई पेमेंट नहीं। कीमत हम कॉल पर आपके साथ तय करते हैं।',
  },

  trip: {
    whereRound: 'कहाँ जाना है?',
    whereOneWay: 'कार कहाँ पहुँचानी है?',
    search: 'शहर या कस्बा खोजें',
    elsewhere: 'कोई और जगह',
    noMatch: 'यह जगह हमारी सूची में नहीं है — “कोई और जगह” चुनें।',
    place: 'शहर या कस्बा',
    placePlaceholder: 'जैसे जयपुर',
    daysRound: 'ट्रिप कितने दिन की',
    daysOneWay: 'ड्राइविंग के दिन',
    daysHint: (min: number) => `इस दूरी के लिए कम से कम ${min} — रुकना हो तो दिन बढ़ाएँ।`,
    daysHintUnknown: 'ड्राइवर कितने दिन चाहिए।',
    fewer: 'एक दिन कम',
    more: 'एक दिन ज़्यादा',
    estimateTitle: 'अनुमानित कीमत',
    route: (from: string, to: string, km: string) => `${from} → ${to} · एक तरफ़ लगभग ${km}`,
    km: (n: string) => `${n} किमी`,
    days: (n: number) => `${n} दिन`,
    returnHours: (n: number) => `ड्राइवर की घर वापसी के ${n} घंटे`,
    drivingDays: (n: number, perDay: number) => `ड्राइविंग के ${n} दिन (हर दिन ${perDay} घंटे)`,
    drivingHours: (n: number, more: boolean) => `${more ? 'और ' : ''}${n} घंटे ड्राइविंग`,
    wayHomeHours: (n: number) => `ड्राइवर की घर वापसी: कार पहुँचाने से घर पहुँचने तक ${n} घंटे, इंतज़ार भी`,
    homeInTime: 'ड्राइवर की घर वापसी',
    noCharge: 'कोई चार्ज नहीं',
    returnMax: (rate: string, max: string, after: number) =>
      `हर दिन ${max}; बचे घंटे ${rate}/घंटा, ${after} से ज़्यादा तो पूरा दिन`,
    returnShort: (n: number) => `घर वापसी (${n} घंटे)`,
    nonstop: 'दिन-रात ड्राइविंग',
    nonstopHint: 'रात में आराम नहीं, तो जल्दी पहुँचेगा — ड्राइविंग की कीमत वही।',
    timelineTitle: 'ड्राइवर का सफ़र',
    driving: 'ड्राइविंग',
    drivingNonstop: (h: number) => `लगभग ${h} घंटे, दिन-रात`,
    drivingDaysRest: (h: number, perDay: number) => `लगभग ${h} घंटे: रोज़ लगभग ${perDay} घंटे, रात में आराम`,
    leaves: (city: string) => `${city} से निकलेगा`,
    drops: (place: string) => `${place} में कार पहुँचाएगा`,
    wayHome: 'घर वापसी, आम तौर पर लगने वाला समय (टिकट आप बुक करें)',
    onBoard: (h: number) => `लगभग ${h} घंटे`,
    homeIn: (city: string) => `${city} में घर`,
    about: (when: string) => `लगभग ${when}`,
    times: (what: string, rate: string) => `${what} × ${rate}`,
    shortDrive: (h: number, first: number, localAfter: number, firstPrice: string, rate: string) =>
      h <= first
        ? `${h} घंटे ड्राइविंग: ${first} घंटे तक = ${firstPrice}`
        : h <= localAfter
          ? `${h} घंटे ड्राइविंग: पहले ${first} घंटे ${firstPrice} + ${h - first} घंटे × ${rate}`
          : `${h} घंटे ड्राइविंग: ${localAfter} घंटे से ज़्यादा = शहर का पूरा दिन`,
    shortDriveBill: (amount: string, h: number) => `${amount} — ${h} घंटे ड्राइविंग`,
    chooseCity: 'अनुमान देखने के लिए ऊपर अपना शहर चुनें।',
    chooseDest: 'अनुमान देखने के लिए चुनें कि कहाँ जाना है।',
    elsewhereNote: (rate: string) =>
      `हम दूरी देखकर कॉल पर कीमत बताएँगे: ${rate} प्रति दिन, दूरी के हिसाब से।`,
    elsewhereReturn: (rate: string, max: string, after: number) =>
      `ड्राइवर की घर वापसी, कार पहुँचाने से घर पहुँचने तक: हर 24 घंटे ${max}; बचे घंटे ${rate} प्रति घंटा, ${after} घंटे से ज़्यादा तो पूरा दिन।`,
    sameCity: 'यह आपका पिकअप शहर है — शहर के अंदर के लिए लोकल पैकेज चुनें।',
    localTip: (place: string, km: string, price: string) =>
      `${place} सिर्फ़ लगभग ${km} दूर है — शहर में पूरा दिन (${price}) आमतौर पर सस्ता पड़ता है।`,
    useLocal: 'पूरा दिन चुनें',
    smallPrint: (
      hours: number,
      extra: string,
      meal: string,
      oneWay: boolean,
      extraAfter?: number,
      homeAfter?: number,
    ) =>
      `यह अनुमान है: सही कीमत ड्राइवर के निकलने से पहले कॉल पर तय होगी। ${oneWay ? `हर ${hours} घंटे की ड्राइविंग एक दिन; बचे घंटे ${extra} प्रति घंटा${extraAfter !== undefined ? `, ${extraAfter} से ज़्यादा तो पूरा दिन` : ''}। कार पहुँचाने से घर पहुँचने तक ड्राइवर की वापसी (ट्रेन का इंतज़ार भी): हर 24 घंटे एक दिन, बचे घंटे प्रति घंटा${homeAfter !== undefined ? `, ${homeAfter} से ज़्यादा तो पूरा दिन` : ''}। आख़िरी बिल असल समय से बनेगा। उसका बस या ट्रेन का टिकट आप बुक करें।` : `हर दिन ड्राइवर के शुरुआत से 24 घंटे का है — ${hours} घंटे तक ड्राइविंग (उसके बाद ${extra} प्रति घंटा)।`} पेट्रोल/डीज़ल, टोल और पार्किंग अलग से। ड्राइवर को खाना दें, या ${meal} प्रति दिन।`,
    summaryRound: 'आना-जाना',
    summaryOneWay: 'वन-वे ड्रॉप',
    estimate: (range: string) => `अनुमान ${range}`,
    priceOnCall: 'कीमत कॉल पर',
    extraHours: (n: number) => `${n} घंटे अतिरिक्त`,
    ticket: (amount: string) => `${amount} टिकट`,
    billExtra: (amount: string, n: number) => `${amount} ${n} घंटे अतिरिक्त ड्राइविंग`,
    clockLeft: (at: string) => `ड्राइवर निकले ${at}`,
    clockDropped: (at: string) => `गाड़ी छोड़ी ${at}`,
    clockHome: (at: string) => `ड्राइवर घर पहुँचे ${at}`,
    clockBack: (at: string) => `वापस आए ${at}`,
  },

  success: {
    title: 'बुकिंग मिल गई!',
    body: (phone: string) => `ड्राइवर कन्फ़र्म करने के लिए हम कुछ ही मिनट में ${phone} पर कॉल करेंगे।`,
    track: 'यह बुकिंग ट्रैक करें',
    guestTip: 'अगली बार लॉग इन करें — बुकिंग यहीं ट्रैक होगी और ड्राइवर की जानकारी मिलेगी।',
    another: 'एक और ड्राइवर बुक करें',
    home: 'होम पर जाएँ',
  },

  failure: {
    title: 'बुकिंग सेव नहीं हो पाई',
    config:
      'इस वर्ज़न में ऑनलाइन बुकिंग अभी चालू नहीं है। अपनी जानकारी WhatsApp पर भेजें — हम तुरंत कन्फ़र्म करेंगे।',
    permission: 'अभी आपकी बुकिंग सेव नहीं हो पाई। कृपया WhatsApp पर भेजें या कॉल करें — हम तुरंत देखेंगे।',
    network: 'सेव करते समय इंटरनेट कट गया। इंटरनेट चेक करें, या जानकारी WhatsApp पर भेज दें।',
    timeout:
      'बहुत देर लग रही है — शायद इंटरनेट धीमा है। बुकिंग फिर भी पहुँच सकती है; पक्का करने के लिए WhatsApp पर भी भेज दें।',
    unknown:
      'सेव करते समय कुछ गड़बड़ हुई। कृपया WhatsApp पर भेजें या कॉल करें — हम आपको इंतज़ार नहीं कराना चाहते।',
    sendWhatsapp: 'WhatsApp पर भेजें',
  },

  whatsappBooking: {
    intro: 'नमस्ते DriveBuddy, मुझे ड्राइवर बुक करना है।',
    name: 'नाम',
    mobile: 'मोबाइल',
    city: 'शहर',
    service: 'सेवा',
    pickup: 'पिकअप',
    when: 'समय',
    notes: 'नोट्स',
    trip: 'ट्रिप',
  },

  errors: {
    name: {
      required: 'कृपया अपना नाम लिखें।',
      tooShort: 'कृपया पूरा नाम लिखें।',
      tooLong: 'नाम 60 अक्षरों से छोटा रखें।',
    },
    phone: {
      required: 'बुकिंग कन्फ़र्म करने के लिए मोबाइल नंबर ज़रूरी है।',
      invalidMobile: '10 अंकों का मोबाइल नंबर लिखें, ताकि हम कॉल कर सकें।',
    },
    city: { required: 'कृपया अपना शहर चुनें।' },
    packageId: { required: 'कृपया एक सेवा चुनें।' },
    destId: { required: 'कृपया चुनें कि कहाँ जाना है।' },
    destOther: {
      required: 'जिस शहर या कस्बे में जाना है, उसका नाम लिखें।',
      tooShort: 'जिस शहर या कस्बे में जाना है, उसका नाम लिखें।',
      tooLong: 'जगह का नाम 60 अक्षरों से छोटा रखें।',
    },
    days: { invalidNumber: '1 से 60 दिन के बीच चुनें।' },
    pickup: {
      required: 'पिकअप का पता लिखें, ताकि ड्राइवर आप तक पहुँच सके।',
      tooShort: 'थोड़ा और विस्तार से लिखें — इलाका या लैंडमार्क।',
      tooLong: 'पता 300 अक्षरों से छोटा रखें।',
    },
    notes: { tooLong: 'इसे 500 अक्षरों से छोटा रखें।' },
    preferredTime: {
      required: 'कृपया समय चुनें, या “जितनी जल्दी हो सके” चुनें।',
      tooLong: 'कृपया समय फिर से चुनें।',
    },
    generic: 'कृपया यह फ़ील्ड देखें।',
  },

  status: {
    new: { label: 'मिल गई', detail: 'कन्फ़र्म करने के लिए हम जल्द ही कॉल करेंगे।' },
    confirmed: { label: 'कन्फ़र्म', detail: 'आपकी बुकिंग कन्फ़र्म है। हम आपका ड्राइवर चुन रहे हैं।' },
    assigned: { label: 'ड्राइवर तय', detail: 'आपके ड्राइवर की जानकारी नीचे है।' },
    completed: { label: 'पूरी हुई', detail: 'DriveBuddy चुनने के लिए धन्यवाद।' },
    cancelled: { label: 'रद्द', detail: 'यह बुकिंग रद्द कर दी गई।' },
  },

  bookings: {
    title: 'मेरी बुकिंग',
    current: 'चालू',
    past: 'पिछली',
    empty: 'अभी कोई बुकिंग नहीं',
    emptyBody: 'लॉग इन करके की गई बुकिंग यहाँ लाइव स्टेटस के साथ दिखती हैं।',
    signedOutTitle: 'अपनी सारी बुकिंग देखें',
    signedOutBody: 'लॉग इन करें — हर बुकिंग लाइव देखें और ड्राइवर तय होते ही सूचना पाएँ।',
    guestNote: 'बिना लॉग इन के बुक किया? चिंता न करें — हम आपके दिए नंबर पर कॉल करेंगे।',
    numbering: 'नंबर मिल रहा है…',
    asap: 'जितनी जल्दी हो सके',
    loadError: 'आपकी बुकिंग लोड नहीं हो पाईं। फिर से कोशिश करने के लिए नीचे खींचें।',
  },

  detail: {
    title: 'बुकिंग',
    reference: 'बुकिंग नंबर',
    when: 'कब',
    pickup: 'पिकअप',
    city: 'शहर',
    notes: 'नोट्स',
    trip: 'ट्रिप',
    price: 'तय कीमत',
    tripTimes: 'ट्रिप का समय',
    finalBill: 'फ़ाइनल बिल (असली समय से)',
    bookedOn: 'बुकिंग की तारीख़',
    yourDriver: 'आपका ड्राइवर',
    callDriver: 'ड्राइवर को कॉल करें',
    cancelReason: (reason: string) => `कारण: ${reason}`,
    help: 'इस बुकिंग के बारे में कुछ पूछना है?',
    helpMessage: (ref: string) => `नमस्ते DriveBuddy, मेरी बुकिंग ${ref} के बारे में: `,
    notFound: 'यह बुकिंग नहीं मिली।',
    reviewTitle: 'ड्राइवर पसंद आया?',
    reviewBody: 'आपका Google रिव्यू दूसरे परिवारों को भरोसेमंद ड्राइवर ढूँढने में मदद करता है।',
    reviewButton: 'रिव्यू लिखें',
  },

  account: {
    title: 'अकाउंट',
    signedOutTitle: 'DriveBuddy में लॉग इन करें',
    benefits: [
      'हर बुकिंग लाइव देखें',
      'ड्राइवर तय होते ही सूचना',
      'तेज़ बुकिंग — आपकी जानकारी अपने-आप भर जाती है',
    ],
    google: 'Google से जारी रखें',
    signingIn: 'लॉग इन हो रहा है…',
    loginUnavailable:
      'इस वर्ज़न में लॉग इन अभी चालू नहीं है। आप फिर भी बुक कर सकते हैं — हम कॉल करके कन्फ़र्म करेंगे।',
    profile: 'आपकी जानकारी',
    profileHint: 'बुकिंग फ़ॉर्म में अपने-आप भरने के लिए।',
    signOut: 'लॉग आउट',
    notifications: 'बुकिंग की सूचनाएँ',
    notificationsOn: 'चालू — बुकिंग कन्फ़र्म होने या ड्राइवर तय होने पर हम सूचना भेजते हैं।',
    notificationsOff: 'बंद',
    notificationsTurnOn: 'चालू करें',
    notificationsDenied: 'फ़ोन की सेटिंग में बंद हैं।',
    openSettings: 'सेटिंग खोलें',
    notificationsUnavailable: 'इस डिवाइस पर उपलब्ध नहीं।',
    language: 'भाषा',
    help: 'मदद और जानकारी',
    website: 'वेबसाइट',
    privacy: 'प्राइवेसी पॉलिसी',
    terms: 'सेवा की शर्तें',
    version: (v: string) => `वर्ज़न ${v}`,
    statsTitle: 'गुमनाम इस्तेमाल के आँकड़े',
    statsBody: 'इससे हम ऐप बेहतर बनाते हैं। कोई नाम, नंबर या पता कभी नहीं भेजा जाता।',
    deleteLink: 'मेरा अकाउंट डिलीट करें',
    deleteTitle: 'अपना DriveBuddy अकाउंट डिलीट करें?',
    deleteBody:
      'इससे आपका लॉग इन, सेव किया नाम और नंबर, और फ़ोन पर सूचनाएँ हट जाएँगी। पुरानी बुकिंग हिसाब और सुरक्षा के लिए हमारे रिकॉर्ड में रहेंगी, लेकिन किसी लॉग इन से जुड़ी नहीं होंगी। आप कभी भी बिना लॉग इन के बुक कर सकते हैं।',
    deleteConfirm: 'हाँ, मेरा अकाउंट डिलीट करें',
    deleteFailed:
      'अभी अकाउंट डिलीट नहीं हो पाया। इंटरनेट चेक करके फिर कोशिश करें, या हमें WhatsApp करें — हम कर देंगे।',
  },

  authErrors: {
    cancelled: 'लॉग इन रद्द हो गया।',
    playServices: 'इस फ़ोन में Google Play services नहीं है या पुराना है।',
    network: 'इंटरनेट कट गया। इंटरनेट चेक करके फिर कोशिश करें।',
    notEnabled: 'लॉग इन अभी चालू नहीं है। फ़िलहाल बिना लॉग इन के बुक करें।',
    unknown: 'कुछ गड़बड़ हुई। फिर से कोशिश करें, या बिना लॉग इन के बुक करें।',
  },

  push: {
    channelName: 'बुकिंग की सूचनाएँ',
  },

  dates: {
    weekdays: ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'],
    months: ['जन॰', 'फ़र॰', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अग॰', 'सित॰', 'अक्टू॰', 'नव॰', 'दिस॰'],
    /** (15, "3:30") → "दोपहर 3:30" — Hindi names the part of the day instead of am/pm. */
    time: (hour: number, clock: string) => {
      const part = hour < 4 ? 'रात' : hour < 12 ? 'सुबह' : hour < 16 ? 'दोपहर' : hour < 20 ? 'शाम' : 'रात';
      return `${part} ${clock}`;
    },
    day: (weekday: string, day: number, month: string) => `${weekday}, ${day} ${month}`,
    dateTime: (date: string, time: string) => `${date}, ${time}`,
  },

  notFound: {
    title: 'पेज नहीं मिला',
    home: 'होम पर जाएँ',
  },

  update: {
    title: 'कृपया DriveBuddy अपडेट करें',
    body: 'ऐप का यह वर्ज़न बुकिंग के लिए बहुत पुराना है। नया वर्ज़न एक मिनट में इंस्टॉल हो जाता है।',
    button: 'अभी अपडेट करें',
    orCall: 'ड्राइवर अभी चाहिए? हमें कॉल या WhatsApp करें।',

    readyTitle: 'नया वर्ज़न तैयार है',
    readyBody: 'नया DriveBuddy पाने के लिए अपडेट दबाएँ।',
    readyButton: 'अपडेट',
    later: 'बाद में',
  },
};
