// Конфігурація гри
const CONFIG = {
    CASE_PRICE: 1,
    REWARDS: [
        { type: 'jackpot', stars: 10, chance: 0.01, icon: '💰', color: '#FFD700' },
        { type: 'big', stars: 3, chance: 0.05, icon: '💎', color: '#4ECDC4' },
        { type: 'medium', stars: 2, chance: 0.10, icon: '🔮', color: '#9B59B6' },
        { type: 'small', stars: 1, chance: 0.50, icon: '⭐', color: '#3498DB' },
        { type: 'nothing', stars: 0, chance: 0.34, icon: '💨', color: '#95A5A6' }
    ],
    SPECIAL_CASES: [
        { id: 1, name: 'Звичайний', price: 1, icon: '🎁', color: '#FF6B6B', multiplier: 1 },
        { id: 2, name: 'Рідкісний', price: 3, icon: '📦', color: '#4ECDC4', multiplier: 2 },
        { id: 3, name: 'Епічний', price: 5, icon: '💼', color: '#9B59B6', multiplier: 3 },
        { id: 4, name: 'Легендарний', price: 10, icon: '👑', color: '#FFD700', multiplier: 5 }
    ],
    OWNER_ID: 6662507956, // Ваш ID
    OWNER_USERNAME: 'Artemchixst',
    API_URL: 'https://xstgifts-backend.vercel.app/api' // Ваш бекенд
};

// Основний клас гри
class CaseRouletteGame {
    constructor() {
        this.balance = 0;
        this.totalWon = 0;
        this.casesOpened = 0;
        this.isSpinning = false;
        this.user = null;
        this.isOwner = false;
        this.paymentAmount = 0;
        
        this.init();
    }
    
    async init() {
        this.showLoading('Завантаження гри...');
        
        await this.initTelegram();
        await this.loadUserData();
        
        this.renderCases();
        this.renderProbabilities();
        this.updateUI();
        
        this.hideLoading();
        
        setTimeout(() => {
            this.showNotification('🎉 Ласкаво просимо до Case Roulette!');
        }, 500);
    }
    
    async initTelegram() {
        if (window.Telegram?.WebApp) {
            try {
                Telegram.WebApp.ready();
                Telegram.WebApp.expand();
                
                const initData = Telegram.WebApp.initDataUnsafe;
                this.user = initData.user;
                
                // Перевірка чи це власник
                if (this.user.id === CONFIG.OWNER_ID || 
                    this.user.username === CONFIG.OWNER_USERNAME) {
                    this.isOwner = true;
                    console.log('👑 Власник гри зайшов!');
                }
                
                // Слухаємо події оплати
                Telegram.WebApp.onEvent('invoiceClosed', this.handlePayment.bind(this));
                
            } catch (error) {
                console.error('Telegram init error:', error);
                this.user = { id: 0, username: 'test' };
            }
        } else {
            console.log('Development mode');
            this.user = { id: 0, username: 'test' };
            this.balance = 100;
        }
    }
    
    async loadUserData() {
        try {
            if (!this.user) return;
            
            // Для власника - безкоштовні зірки
            if (this.isOwner) {
                this.balance = 999999;
                this.totalWon = 0;
                this.casesOpened = 0;
                this.saveUserData();
                return;
            }
            
            const savedData = localStorage.getItem(`case_roulette_user_${this.user.id}`);
            
            if (savedData) {
                const data = JSON.parse(savedData);
                this.balance = data.balance || 0;
                this.totalWon = data.totalWon || 0;
                this.casesOpened = data.casesOpened || 0;
            } else {
                this.balance = 0;
                this.saveUserData();
                
                // Відправляємо сповіщення про нового користувача
                await this.notifyNewUser();
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }
    
    saveUserData() {
        if (!this.user || this.isOwner) return;
        
        const data = {
            balance: this.balance,
            totalWon: this.totalWon,
            casesOpened: this.casesOpened,
            lastPlayed: new Date().toISOString()
        };
        
        localStorage.setItem(`case_roulette_user_${this.user.id}`, JSON.stringify(data));
    }
    
    async notifyNewUser() {
        try {
            // Відправляємо дані на бекенд про нового користувача
            const response = await fetch(`${CONFIG.API_URL}/new-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.id,
                    username: this.user.username,
                    firstName: this.user.first_name,
                    lastName: this.user.last_name,
                    languageCode: this.user.language_code,
                    isPremium: this.user.is_premium || false
                })
            });
            
            console.log('New user notification sent');
        } catch (error) {
            console.error('Failed to notify about new user:', error);
        }
    }
    
    renderCases() {
        const container = document.getElementById('casesContainer');
        container.innerHTML = '';
        
        CONFIG.SPECIAL_CASES.forEach(caseItem => {
            const caseElement = document.createElement('div');
            caseElement.className = 'case';
            caseElement.style.setProperty('--case-color', caseItem.color);
            
            caseElement.innerHTML = `
                <div class="case-icon">${caseItem.icon}</div>
                <div class="case-name">${caseItem.name}</div>
                <div class="case-price">
                    <span class="star-icon">⭐</span>
                    ${caseItem.price}
                </div>
            `;
            
            caseElement.onclick = () => this.openCase(caseItem);
            container.appendChild(caseElement);
        });
    }
    
    renderProbabilities() {
        const container = document.getElementById('probabilitiesList');
        container.innerHTML = '';
        
        CONFIG.REWARDS.forEach(reward => {
            const item = document.createElement('div');
            item.className = 'probability-item';
            item.innerHTML = `
                <div>
                    <span style="font-size: 20px; margin-right: 10px;">${reward.icon}</span>
                    <span>${reward.stars === 0 ? 'Нічого' : `${reward.stars}x прибуток`}</span>
                </div>
                <div style="color: ${reward.color}; font-weight: bold;">
                    ${(reward.chance * 100).toFixed(1)}%
                </div>
            `;
            container.appendChild(item);
        });
    }
    
    async openCase(caseItem) {
        if (this.isSpinning) return;
        
        // Для власника - безкоштовно
        if (this.isOwner) {
            this.balance += 1000; // Бонуси власнику
        }
        
        if (this.balance < caseItem.price) {
            this.showNotification(`Недостатньо Stars! Потрібно ${caseItem.price} ⭐`);
            this.showPaymentModal();
            return;
        }
        
        this.balance -= caseItem.price;
        this.casesOpened++;
        this.saveUserData();
        
        this.isSpinning = true;
        this.startRoulette(caseItem);
    }
    
    calculateReward(caseItem) {
        const random = Math.random();
        let accumulatedChance = 0;
        
        for (const reward of CONFIG.REWARDS) {
            accumulatedChance += reward.chance;
            if (random <= accumulatedChance) {
                return {
                    ...reward,
                    finalStars: reward.stars * caseItem.multiplier,
                    caseMultiplier: caseItem.multiplier
                };
            }
        }
        
        return {
            ...CONFIG.REWARDS[CONFIG.REWARDS.length - 1],
            finalStars: 0,
            caseMultiplier: caseItem.multiplier
        };
    }
    
    startRoulette(caseItem) {
        const roulette = document.getElementById('roulette');
        const rouletteItems = document.getElementById('rouletteItems');
        
        roulette.style.display = 'block';
        document.querySelectorAll('.case').forEach(el => {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.5';
        });
        
        this.generateRouletteItems(rouletteItems, caseItem);
        
        const reward = this.calculateReward(caseItem);
        
        const itemWidth = 100;
        const totalItems = 100;
        const winningIndex = Math.floor(Math.random() * 30) + 35;
        const targetPosition = -(winningIndex * itemWidth) + 200;
        
        rouletteItems.style.transition = 'none';
        rouletteItems.style.transform = 'translateX(0)';
        
        setTimeout(() => {
            rouletteItems.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
            rouletteItems.style.transform = `translateX(${targetPosition}px)`;
        }, 50);
        
        setTimeout(() => {
            this.showResult(reward, caseItem);
            this.isSpinning = false;
            roulette.style.display = 'none';
            
            document.querySelectorAll('.case').forEach(el => {
                el.style.pointerEvents = 'auto';
                el.style.opacity = '1';
            });
        }, 3500);
    }
    
    generateRouletteItems(container, caseItem) {
        container.innerHTML = '';
        
        for (let i = 0; i < 100; i++) {
            const item = document.createElement('div');
            item.className = 'roulette-item';
            
            const random = Math.random();
            let rewardType;
            let accumulatedChance = 0;
            
            for (const reward of CONFIG.REWARDS) {
                accumulatedChance += reward.chance;
                if (random <= accumulatedChance) {
                    rewardType = reward;
                    break;
                }
            }
            
            if (!rewardType) rewardType = CONFIG.REWARDS[CONFIG.REWARDS.length - 1];
            
            item.innerHTML = `
                <div class="roulette-item-icon" style="color: ${rewardType.color}">
                    ${rewardType.icon}
                </div>
                <div class="roulette-item-amount">
                    ${rewardType.stars * caseItem.multiplier}
                </div>
            `;
            
            container.appendChild(item);
        }
    }
    
    showResult(reward, caseItem) {
        const resultOverlay = document.getElementById('resultOverlay');
        const resultIcon = document.getElementById('resultIcon');
        const resultText = document.getElementById('resultText');
        const resultAmount = document.getElementById('resultAmount');
        
        if (reward.finalStars > 0) {
            this.balance += reward.finalStars;
            this.totalWon += reward.finalStars;
            this.createConfetti();
        }
        
        this.updateUI();
        this.saveUserData();
        
        if (reward.finalStars > 0) {
            resultIcon.textContent = reward.icon;
            resultIcon.style.color = reward.color;
            resultText.textContent = '🎉 Вітаємо! Ви виграли:';
            resultAmount.textContent = `${reward.finalStars} ⭐`;
            resultAmount.style.color = reward.color;
            
            if (caseItem.multiplier > 1) {
                resultText.innerHTML += `<br><small>(Множник: x${caseItem.multiplier})</small>`;
            }
            
            this.showNotification(`Ви виграли ${reward.finalStars} Stars! 🎉`);
        } else {
            resultIcon.textContent = '💨';
            resultIcon.style.color = '#95A5A6';
            resultText.textContent = '😔 Наступного разу пощастить!';
            resultAmount.textContent = '0 ⭐';
            resultAmount.style.color = '#95A5A6';
            
            this.showNotification('Спробуйте ще раз! 💪');
        }
        
        resultOverlay.style.display = 'flex';
    }
    
    closeResult() {
        const resultOverlay = document.getElementById('resultOverlay');
        resultOverlay.style.display = 'none';
    }
    
    shareResult() {
        if (window.Telegram?.WebApp) {
            const shareText = `Я виграв ${this.totalWon} Stars у Case Roulette! Спробуй і ти! 🎰`;
            Telegram.WebApp.share(shareText);
        } else {
            this.showNotification('Скопійовано в буфер обміну!');
            navigator.clipboard.writeText(`Я граю в Case Roulette! Спробуй і ти! 🎰`);
        }
    }
    
    showStats() {
        const stats = `
            📊 Ваша статистика:
            
            Баланс: ${this.balance} ⭐
            Відкрито кейсів: ${this.casesOpened}
            Виграно всього: ${this.totalWon} ⭐
            Середній виграш: ${this.casesOpened > 0 ? (this.totalWon / this.casesOpened).toFixed(1) : 0} ⭐
            
            Удачі в наступних іграх! 🍀
        `;
        
        alert(stats);
    }
    
    // ПОПОВНЕННЯ БАЛАНСУ
    showPaymentModal() {
        const modal = document.createElement('div');
        modal.id = 'paymentModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                       padding: 30px;
                       border-radius: 20px;
                       width: 90%;
                       max-width: 400px;
                       border: 2px solid rgba(255,255,255,0.1);">
                <h2 style="text-align: center; margin-bottom: 20px; color: #ffd700;">
                    💰 Поповнення балансу
                </h2>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 10px; opacity: 0.8;">
                        Скільки Stars ви хочете внести?
                    </label>
                    <input type="number" id="starsAmount" 
                           min="1" max="10000" value="100"
                           style="width: 100%;
                                  padding: 15px;
                                  border: 2px solid rgba(255,255,255,0.2);
                                  background: rgba(0,0,0,0.5);
                                  color: white;
                                  border-radius: 10px;
                                  font-size: 18px;
                                  text-align: center;">
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button onclick="setAmount(50)" style="flex:1; padding: 10px; background: #667eea; border: none; color: white; border-radius: 5px;">50</button>
                        <button onclick="setAmount(100)" style="flex:1; padding: 10px; background: #667eea; border: none; color: white; border-radius: 5px;">100</button>
                        <button onclick="setAmount(500)" style="flex:1; padding: 10px; background: #667eea; border: none; color: white; border-radius: 5px;">500</button>
                        <button onclick="setAmount(1000)" style="flex:1; padding: 10px; background: #667eea; border: none; color: white; border-radius: 5px;">1000</button>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 20px 0; padding: 15px; background: rgba(255,215,0,0.1); border-radius: 10px;">
                    <div style="font-size: 14px; opacity: 0.8;">Приблизно:</div>
                    <div style="font-size: 24px; font-weight: bold; color: #ffd700;">
                        <span id="usdAmount">~$1.00</span> USD
                    </div>
                    <div style="font-size: 12px; opacity: 0.6; margin-top: 5px;">
                        1 Star ≈ $0.01
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.game.processPayment()" 
                            style="flex: 1; 
                                   padding: 15px; 
                                   background: linear-gradient(45deg, #4CAF50, #8BC34A);
                                   border: none; 
                                   color: white; 
                                   border-radius: 10px; 
                                   font-size: 16px; 
                                   font-weight: bold;
                                   cursor: pointer;">
                        💳 Оплатити
                    </button>
                    <button onclick="window.game.closePaymentModal()" 
                            style="flex: 1; 
                                   padding: 15px; 
                                   background: rgba(255,255,255,0.1);
                                   border: none; 
                                   color: white; 
                                   border-radius: 10px; 
                                   font-size: 16px;
                                   cursor: pointer;">
                        Скасувати
                    </button>
                </div>
                
                <div style="margin-top: 20px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px; font-size: 12px; opacity: 0.6;">
                    ⚡ Після оплати зірки автоматично з'являться у грі
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Оновлюємо USD еквівалент
        const starsInput = document.getElementById('starsAmount');
        const usdAmount = document.getElementById('usdAmount');
        
        starsInput.addEventListener('input', function() {
            const stars = parseInt(this.value) || 0;
            const usd = (stars * 0.01).toFixed(2);
            usdAmount.textContent = `~$${usd}`;
        });
        
        // Початкове значення
        const initialStars = parseInt(starsInput.value);
        const initialUsd = (initialStars * 0.01).toFixed(2);
        usdAmount.textContent = `~$${initialUsd}`;
    }
    
    closePaymentModal() {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.remove();
        }
    }
    
    // Процес оплати
    async processPayment() {
        const starsInput = document.getElementById('starsAmount');
        const amount = parseInt(starsInput.value);
        
        if (!amount || amount < 1) {
            this.showNotification('Введіть коректну суму!');
            return;
        }
        
        if (amount > 10000) {
            this.showNotification('Максимальна сума: 10,000 Stars');
            return;
        }
        
        this.closePaymentModal();
        this.showLoading('Створення платежу...');
        
        // Для власника - безкоштовне поповнення
        if (this.isOwner) {
            setTimeout(() => {
                this.balance += amount;
                this.updateUI();
                this.saveUserData();
                this.hideLoading();
                this.showNotification(`🎉 Отримано ${amount} Stars! (Власник)`);
                this.createConfetti();
            }, 1000);
            return;
        }
        
        // Реальний платіж через Telegram Stars
        if (window.Telegram?.WebApp) {
            try {
                // Створюємо платіж у Telegram
                Telegram.WebApp.openInvoice({
                    title: 'Поповнення балансу',
                    description: `Донат на ${amount} Stars для гри Case Roulette`,
                    currency: 'XTR', // Telegram Stars
                    prices: [{ label: `${amount} Stars`, amount: amount }],
                    payload: `payment_${this.user.id}_${Date.now()}`,
                    photo_url: 'https://xstgifts.vercel.app/star-icon.png'
                });
                
                // Зберігаємо суму для подальшої обробки
                this.paymentAmount = amount;
                
            } catch (error) {
                console.error('Payment error:', error);
                this.showNotification('❌ Помилка створення платежу');
            }
        } else {
            // Демо-режим
            setTimeout(() => {
                this.balance += amount;
                this.updateUI();
                this.saveUserData();
                this.hideLoading();
                this.showNotification(`🎉 Демо: отримано ${amount} Stars!`);
                this.createConfetti();
            }, 1500);
        }
        
        this.hideLoading();
    }
    
    // Обробка платежу від Telegram
    async handlePayment(event) {
        console.log('Payment event:', event);
        
        if (event.status === 'paid') {
            // Платіж успішний
            const amount = this.paymentAmount || event.amount || 100;
            
            // Нараховуємо зірки
            this.balance += amount;
            this.updateUI();
            this.saveUserData();
            
            // Сповіщення
            this.showNotification(`🎉 Успішно! +${amount} Stars на балансі!`);
            this.createConfetti();
            
            // Відправляємо дані про платіж на бекенд
            await this.sendPaymentToBackend(amount);
            
            // Сповіщення власнику про донат
            await this.notifyOwnerAboutDonation(amount);
            
        } else if (event.status === 'failed') {
            this.showNotification('❌ Оплата не пройшла. Спробуйте ще раз.');
        } else if (event.status === 'pending') {
            this.showNotification('⏳ Платіж обробляється...');
        } else if (event.status === 'cancelled') {
            this.showNotification('🚫 Оплату скасовано');
        }
    }
    
    async sendPaymentToBackend(amount) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.id,
                    username: this.user.username,
                    amount: amount,
                    type: 'donation',
                    timestamp: new Date().toISOString()
                })
            });
            
            console.log('Payment data sent to backend');
        } catch (error) {
            console.error('Failed to send payment data:', error);
        }
    }
    
    async notifyOwnerAboutDonation(amount) {
        try {
            // Відправляємо повідомлення власнику про донат
            const response = await fetch(`${CONFIG.API_URL}/notify-donation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromUserId: this.user.id,
                    fromUsername: this.user.username,
                    amount: amount,
                    timestamp: new Date().toISOString()
                })
            });
            
            console.log('Donation notification sent to owner');
        } catch (error) {
            console.error('Failed to notify owner:', error);
        }
    }
    
    updateUI() {
        const balanceElement = document.getElementById('balance');
        if (balanceElement) {
            balanceElement.textContent = this.balance;
            
            // Якщо це власник - додаємо корону
            if (this.isOwner) {
                balanceElement.innerHTML = `👑 ${this.balance}`;
            }
        }
        
        const casesCountElement = document.getElementById('casesCount');
        if (casesCountElement) {
            casesCountElement.textContent = this.casesOpened;
        }
        
        const totalWonElement = document.getElementById('totalWon');
        if (totalWonElement) {
            totalWonElement.textContent = this.totalWon;
        }
    }
    
    createConfetti() {
        const confettiCount = 150;
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.innerHTML = Math.random() > 0.5 ? '⭐' : '🎉';
            confetti.style.position = 'fixed';
            confetti.style.fontSize = Math.random() * 20 + 10 + 'px';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.top = '-50px';
            confetti.style.opacity = '0.8';
            confetti.style.zIndex = '9999';
            confetti.style.pointerEvents = 'none';
            
            document.body.appendChild(confetti);
            
            const animation = confetti.animate([
                { 
                    transform: `translate(0, 0) rotate(0deg)`,
                    opacity: 1 
                },
                { 
                    transform: `translate(${(Math.random() - 0.5) * 200}px, ${window.innerHeight}px) rotate(${360 * 3}deg)`,
                    opacity: 0 
                }
            ], {
                duration: Math.random() * 3000 + 2000,
                easing: 'cubic-bezier(0.215, 0.610, 0.355, 1)'
            });
            
            animation.onfinish = () => confetti.remove();
        }
    }
    
    showProbabilities() {
        const modal = document.getElementById('probabilitiesModal');
        modal.style.display = 'flex';
    }
    
    hideProbabilities() {
        const modal = document.getElementById('probabilitiesModal');
        modal.style.display = 'none';
    }
    
    showNotification(message) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    showLoading(text) {
        const loading = document.getElementById('loading');
        const loadingText = document.getElementById('loadingText');
        
        loadingText.textContent = text || 'Завантаження...';
        loading.style.display = 'flex';
    }
    
    hideLoading() {
        const loading = document.getElementById('loading');
        loading.style.display = 'none';
    }
}

// Глобальні функції
let game;

function initGame() {
    game = new CaseRouletteGame();
}

function closeResult() {
    if (game) game.closeResult();
}

function shareResult() {
    if (game) game.shareResult();
}

function buyStars() {
    if (game) game.showPaymentModal();
}

function showStats() {
    if (game) game.showStats();
}

function showProbabilities() {
    if (game) game.showProbabilities();
}

function hideProbabilities() {
    if (game) game.hideProbabilities();
}

function setAmount(amount) {
    const input = document.getElementById('starsAmount');
    if (input) {
        input.value = amount;
        
        // Тригер події для оновлення USD
        const event = new Event('input');
        input.dispatchEvent(event);
    }
}

// Запуск гри
window.addEventListener('DOMContentLoaded', initGame);
window.CaseRouletteGame = CaseRouletteGame;
