/**
 * Tamil (தமிழ்) message templates for WhatsApp bot.
 * Each function returns a formatted string for the given context.
 */

module.exports = {
    languagePrompt: () =>
        `🌐 *Choose your language / மொழியைத் தேர்ந்தெடுக்கவும்*\n\n1️⃣ தமிழ்\n2️⃣ English\n\n*1* அல்லது *2* அனுப்பவும்`,

    welcome: (name) =>
        `வணக்கம் ${name}! 💧 *Thanni Canuuu* இற்கு வரவேற்கிறோம்.\n\nதண்ணீர் ஆர்டர் செய்ய *order* அனுப்பவும்.\nஆர்டர் நிலையை அறிய *status* அனுப்பவும்.`,

    welcomeNew: () =>
        `*Thanni Canuuu* இற்கு வரவேற்கிறோம்! 💧\n\nதொடங்க, உங்கள் பெயரைப் பகிரவும்.\n\nஉதாரணம்: *என் பெயர் குமார்*`,

    askAddress: (name) =>
        `நன்றி ${name}! 👋\n\nஇப்போது உங்கள் *டெலிவரி முகவரியை* பகிரவும்.\n\nஉதாரணம்: *123 மெயின் ஸ்ட்ரீட், அண்ணா நகர்*`,

    addressSaved: () =>
        `✅ முகவரி சேமிக்கப்பட்டது!\n\nநீங்கள் தயார். உங்கள் முதல் ஆர்டரை செய்ய *order* அனுப்பவும்! 🚰`,

    chooseLitre: (stock) =>
        `எந்த அளவு தண்ணீர் கேன் வேண்டும்?\n\nபதிலளிக்கவும்:\n*20* - 20 லிட்டர் கேன்\n*25* - 25 லிட்டர் கேன்\n\n📦 கிடைக்கும் இருப்பு: ${stock} கேன்கள்`,

    chooseQuantity: (litreSize, price, stock) =>
        `நல்லது! *${litreSize}L* தண்ணீர் கேன் தேர்வு செய்யப்பட்டது.\n\nவிலை: ₹${price} ஒரு கேன்\n\nஎத்தனை கேன்கள் வேண்டும்?\nஅளவை பதிலளிக்கவும் (1-10)\n\n📦 கிடைக்கும்: ${stock} கேன்கள்`,

    confirmOrder: (orderId, litreSize, quantity, pricePerCan, total, staffName, shift) =>
        `✅ *ஆர்டர் உறுதி செய்யப்பட்டது!*\n\n*ஆர்டர் ID:* ${orderId}\n*கேன் அளவு:* ${litreSize}L\n*எண்ணிக்கை:* ${quantity} கேன்கள்\n*ஒரு கேன் விலை:* ₹${pricePerCan}\n*மொத்தத் தொகை:* ₹${total}\n*டெலிவரி ஊழியர்:* ${staffName}\n*ஷிப்ட்:* ${shift}\n\nஉங்கள் தண்ணீர் விரைவில் வரும்! 💧`,

    outOfStock: () =>
        `மன்னிக்கவும்! இன்றைக்கு இருப்பு இல்லை. 😔\n\nநாளை மீண்டும் முயற்சிக்கவும்!`,

    lowStock: (available) =>
        `மன்னிக்கவும்! இன்று ${available} கேன்கள் மட்டுமே உள்ளன.\n\nகுறைவாக ஆர்டர் செய்யவும் அல்லது நாளை முயற்சிக்கவும்.`,

    noStaff: () =>
        `மன்னிக்கவும்! இப்போது டெலிவரி ஊழியர் கிடைக்கவில்லை. ⏳\n\nபிறகு முயற்சிக்கவும்.`,

    invalidQuantity: () =>
        `சரியான அளவை உள்ளிடவும் (1-10 கேன்கள்).`,

    startOrder: () =>
        `ஆர்டர் செய்ய *hi* அல்லது *order* அனுப்பவும்.`,

    shareNameFirst: () =>
        `முதலில் உங்கள் பெயர் மற்றும் முகவரியைப் பகிரவும்.\n\n*hi* அனுப்பி தொடங்கவும்.`,

    didNotUnderstand: () =>
        `புரியவில்லை. 😕\n\nஆர்டர் செய்ய *hi* அனுப்பவும்!`,

    error: () =>
        `மன்னிக்கவும், ஏதோ தவறு ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.`,

    orderDelivered: (orderId, amount) =>
        `✅ உங்கள் ஆர்டர் *${orderId}* டெலிவர் செய்யப்பட்டது!\n\nதொகை: ₹${amount}\n\nThanni Canuuu-வை தேர்வு செய்ததற்கு நன்றி! 💧`,

    paymentReminder: (orderId, amount) =>
        `⏳ ஆர்டர் *${orderId}* பணம் செலுத்த நினைவூட்டல்\n\nநிலுவைத் தொகை: ₹${amount}\n\nஉங்கள் டெலிவரி ஏஜென்ட் இடம் பணம் செலுத்தவும்.`,

    // Delivery staff messages (kept in English for staff familiarity)
    staffNewDelivery: (orderId, shift, customerName, address, litreSize, quantity, amount) =>
        `🚚 *புதிய டெலிவரி*\n\n*ஆர்டர் ID:* ${orderId}\n*ஷிப்ட்:* ${shift.toUpperCase()}\n*வாடிக்கையாளர்:* ${customerName}\n*முகவரி:* ${address}\n*கேன் அளவு:* ${litreSize}L\n*எண்ணிக்கை:* ${quantity} கேன்கள்\n*தொகை:* ₹${amount}\n\nவிரைவாக டெலிவர் செய்யவும்!\n\nபதிலளிக்கவும்:\n*DELIVERED* - டெலிவர் ஆனது\n*PAID CASH* - பணம் பெற்றது (ரொக்கம்)\n*PAID UPI* - பணம் பெற்றது (UPI)`,

    staffOrderDelivered: (orderId, amount) =>
        `✅ ஆர்டர் ${orderId} *டெலிவர் ஆனது*!\n\nவசூல் செய்ய வேண்டிய தொகை: ₹${amount}\n⏳ பணம் நிலை: நிலுவை\n\nபணம் வசூல் செய்யவும்.`,

    staffOrderComplete: (orderId, amount, paymentMethod) =>
        `✅ *ஆர்டர் முடிந்தது!*\n\nஆர்டர்: ${orderId}\nதொகை: ₹${amount}\nபணம்: ${paymentMethod} ✓\n\nநல்ல வேலை! 👍`,

    staffCurrentOrder: (orderId) =>
        `📦 தற்போதைய ஆர்டர்: ${orderId}\n\n*பதிலளிக்கவும்:*\n*1* - டெலிவர் ஆனது (பணம் நிலுவை)\n*2* - பணம் பெற்றது (ரொக்கம்)\n*3* - பணம் பெற்றது (UPI)`,

    staffNoPending: () =>
        `உங்களுக்கு நிலுவையில் உள்ள ஆர்டர்கள் எதுவும் இல்லை.`,

    staffPaymentPending: (orderId, amount) =>
        `⏳ ஆர்டர் ${orderId} இல் பணம் நிலுவை\n\nவாடிக்கையாளரிடம் ₹${amount} வசூல் செய்யவும்.`,

    activeOrderMenu: (name, qty, litre, amount, status) =>
        `வணக்கம் ${name}! 💧 *Thanni Canuuu* இற்கு வரவேற்கிறோம்.\n\nசெயலில் உள்ள ஆர்டர்: ${qty} x ${litre}L (₹${amount})\nநிலை: ${status}\n\n*1* - நிலையை சரிபார்க்கவும்\n*2* - புதிய ஆர்டர்`,

    orderStatus: (orderId, items, status, amount) =>
        `📦 *ஆர்டர் ID:* ${orderId}\n*பொருட்கள்:* ${items}\n*நிலை:* ${status}${amount ? `\n*தொகை:* ₹${amount}` : ''}`,

    noRecentOrders: () =>
        `சமீபத்திய ஆர்டர்கள் எதுவுமில்லை. ஆர்டர் செய்ய 'Hi' அனுப்பவும்!`,

    menuChoicePrompt: () =>
        `தயவுசெய்து *1* (நிலை) அல்லது *2* (புதிய ஆர்டர்) என பதிலளிக்கவும்.`,

    orderSummary: (qty, litre, total, address) =>
        `📋 *சுருக்கம்*\n\n${qty} x ${litre}L = ₹${total}\n📍 ${address}\n\nஉறுதிப்படுத்தவா? *YES* / *NO*`,

    orderConfirmedFinal: (orderId, total) =>
        `✅ *ஆர்டர் உறுதி செய்யப்பட்டது!*\nID: ${orderId}\nதொகை: ₹${total}\n\nவிரைவில் விநியோகிக்கப்படும்! 🚚`,

    orderFailed: () =>
        `❌ மன்னிக்கவும், ஆர்டரைச் செயல்படுத்த முடியவில்லை. தயவுசெய்து சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.`,

    orderCancelled: () =>
        `❌ ஆர்டர் ரத்து செய்யப்பட்டது. மீண்டும் தொடங்க 'Hi' அனுப்பவும்.`,

    yesNoPrompt: () =>
        `தயவுசெய்து *YES* அல்லது *NO* என பதிலளிக்கவும்.`,

    localizeStatus: (status) => {
        const statusMap = {
            'pending': 'நிலுவையில் உள்ளது ⏳',
            'assigned': 'ஒதுக்கப்பட்டுள்ளது 🚚',
            'out_for_delivery': 'டெலிவரிக்கு வந்துள்ளது 🚲',
            'delivered': 'டெலிவரி செய்யப்பட்டது ✅',
            'cancelled': 'ரத்து செய்யப்பட்டது ❌'
        };
        return statusMap[status] || status;
    }
};
