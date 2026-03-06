/**
 * English message templates for WhatsApp bot.
 * Each function returns a formatted string for the given context.
 */

module.exports = {
    languagePrompt: () =>
        `🌐 *Choose your language / மொழியைத் தேர்ந்தெடுக்கவும்*\n\n1️⃣ தமிழ்\n2️⃣ English\n\nReply with *1* or *2*`,

    welcome: (name) =>
        `Hello ${name}! 💧 Welcome to *Thanni Canuuu*.\n\nSend *order* to place a new order.\nSend *status* to check your order.`,

    welcomeNew: () =>
        `Welcome to *Thanni Canuuu*! 💧\n\nTo get started, please share your name.\n\nExample: *My name is John*`,

    askAddress: (name) =>
        `Thanks ${name}! 👋\n\nNow please share your *delivery address*.\n\nExample: *123 Main Street, Anna Nagar*`,

    addressSaved: () =>
        `✅ Address saved!\n\nYou're all set. Send *order* to place your first order! 🚰`,

    chooseLitre: (stock) =>
        `Which size water can do you need?\n\nReply with:\n*20* - 20 Litre can\n*25* - 25 Litre can\n\n📦 Available stock: ${stock} cans`,

    chooseQuantity: (litreSize, price, stock) =>
        `Great! *${litreSize}L* water can selected.\n\nPrice: ₹${price} per can\n\nHow many cans do you need?\nReply with quantity (1-10)\n\n📦 Available: ${stock} cans`,

    confirmOrder: (orderId, litreSize, quantity, pricePerCan, total, staffName, shift) =>
        `✅ *Order Confirmed!*\n\n*Order ID:* ${orderId}\n*Can Size:* ${litreSize}L\n*Quantity:* ${quantity} cans\n*Price per can:* ₹${pricePerCan}\n*Total Amount:* ₹${total}\n*Delivery Staff:* ${staffName}\n*Shift:* ${shift}\n\nYour water will be delivered soon! 💧`,

    outOfStock: () =>
        `Sorry! We're out of stock for today. 😔\n\nPlease try again tomorrow!`,

    lowStock: (available) =>
        `Sorry! Only ${available} cans available today.\n\nPlease order less or try tomorrow.`,

    noStaff: () =>
        `Sorry! No delivery staff available right now. ⏳\n\nPlease try again later.`,

    invalidQuantity: () =>
        `Please enter a valid quantity (1-10 cans).`,

    startOrder: () =>
        `Please start your order by sending *hi* or *order*.`,

    shareNameFirst: () =>
        `Please share your name and address first.\n\nSend *hi* to start.`,

    didNotUnderstand: () =>
        `I didn't understand that. 😕\n\nSend *hi* to place an order!`,

    error: () =>
        `Sorry, something went wrong. Please try again.`,

    orderDelivered: (orderId, amount) =>
        `✅ Your order *${orderId}* has been delivered!\n\nAmount: ₹${amount}\n\nThank you for choosing Thanni Canuuu! 💧`,

    paymentReminder: (orderId, amount) =>
        `⏳ Payment reminder for Order *${orderId}*\n\nAmount due: ₹${amount}\n\nPlease pay your delivery agent.`,

    // Delivery staff messages
    staffNewDelivery: (orderId, shift, customerName, address, litreSize, quantity, amount) =>
        `🚚 *New Delivery Assignment*\n\n*Order ID:* ${orderId}\n*Shift:* ${shift.toUpperCase()}\n*Customer:* ${customerName}\n*Address:* ${address}\n*Can Size:* ${litreSize}L\n*Quantity:* ${quantity} cans\n*Amount:* ₹${amount}\n\nPlease deliver ASAP!\n\nReply:\n*DELIVERED* - Mark as delivered\n*PAID CASH* - Delivered & paid (cash)\n*PAID UPI* - Delivered & paid (UPI)`,

    staffOrderDelivered: (orderId, amount) =>
        `✅ Order ${orderId} marked as *DELIVERED*!\n\nAmount to collect: ₹${amount}\n⏳ Payment status: Pending\n\nRemember to collect payment.`,

    staffOrderComplete: (orderId, amount, paymentMethod) =>
        `✅ *Order Complete!*\n\nOrder: ${orderId}\nAmount: ₹${amount}\nPayment: ${paymentMethod} ✓\n\nGreat work! 👍`,

    staffCurrentOrder: (orderId) =>
        `📦 Current Order: ${orderId}\n\n*Reply with:*\n*1* - Delivered (payment pending)\n*2* - Delivered & Paid (Cash)\n*3* - Delivered & Paid (UPI)`,

    staffNoPending: () =>
        `No pending orders found for you.`,

    staffPaymentPending: (orderId, amount) =>
        `⏳ Payment pending for Order ${orderId}\n\nRemember to collect ₹${amount} from customer.`,

    activeOrderMenu: (name, qty, litre, amount, status) =>
        `Hello ${name}! 💧 Welcome to *Thanni Canuuu*.\n\nActive Order: ${qty} x ${litre}L (₹${amount})\nStatus: ${status}\n\n*1* - Check Status\n*2* - New Order`,

    orderStatus: (orderId, items, status, amount) =>
        `📦 *Order ID:* ${orderId}\n*Items:* ${items}\n*Status:* ${status}${amount ? `\n*Amount:* ₹${amount}` : ''}`,

    noRecentOrders: () =>
        `No recent orders found. Send 'Hi' to start!`,

    menuChoicePrompt: () =>
        `Please reply with *1* (Status) or *2* (New Order).`,

    orderSummary: (qty, litre, total, address) =>
        `📋 *Summary*\n\n${qty} x ${litre}L = ₹${total}\n📍 ${address}\n\nConfirm? *YES* / *NO*`,

    orderConfirmedFinal: (orderId, total) =>
        `✅ *Order Confirmed!*\nID: ${orderId}\nAmount: ₹${total}\n\nDelivering soon! 🚚`,

    orderFailed: () =>
        `❌ Sorry, could not process order. Please try again later.`,

    orderCancelled: () =>
        `❌ Order cancelled. Send 'Hi' to start again.`,

    yesNoPrompt: () =>
        `Please reply *YES* or *NO*.`,

    localizeStatus: (status) => {
        const statusMap = {
            'pending': 'Pending ⏳',
            'assigned': 'Assigned 🚚',
            'out_for_delivery': 'Out for Delivery 🚲',
            'delivered': 'Delivered ✅',
            'cancelled': 'Cancelled ❌'
        };
        return statusMap[status] || status;
    }
};
