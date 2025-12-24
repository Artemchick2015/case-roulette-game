// Конфігурація гри
const CONFIG = {
    CASE_PRICE: 1, // 1 Star за стандартний кейс
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
    ]
};

// Основний клас гри
class CaseRouletteGame {
    constructor() {
        this.balance = 0;
        this.totalWon = 0;
        this.casesOpened = 0;
        this.isSpinning = false;
        this.user = null;
        
        this.init();
    }
    
    // Ініціалізація
    async init() {
        this.showLoading('Завантаження гри...');
        
        // Ініціалізація Telegram
        await this.initTelegram();
        
        // Завантаження даних
        await this.loadUserData();
        
        // Рендер інтерфейсу
        this.renderCases();
        this.renderProbabilities();
        this.updateUI();
        
        this.hideLoading();
        
        // Показуємо привітальне повідомлення
        setTimeout(() => {
            this.showNotification('🎉 Ласкаво просимо до Case Roulette!');
        }, 500);
    }
    
    // Ініціалізація Telegram WebApp
    async initTelegram() {
        if (window.Telegram?.WebApp) {
            try {
                Telegram.WebApp.ready();
                Telegram.WebApp.expand();
                
                // Отримуємо дані користувача
                const initData = Telegram.WebApp.initDataUnsafe;
                this.user = initData.user;
                
                console.log('Telegram user:', this.user);
                
                // Слухаємо події
                Telegram.WebApp.onEvent('invoiceClosed', this.handlePayment.bind(this));
                
            } catch (error) {
                console.error('Telegram initialization error:', error);
                // Режим розробки
                this.user = { id: 123456789, username: 'test_user' };
            }
        } else {
            console.log('Development mode - no Telegram');
            // Тестові дані для розробки
            this.user = { id: 123456789, username: 'test_user' };
            this.balance = 50;
            this.totalWon = 0;
            this.casesOpened = 0;
        }
    }
    
    // Завантаження даних користувача
    async loadUserData() {
        try {
            if (!this.user) return;
            
            // Тут буде запит до вашого бекенду
            // Для прикладу використовуємо локальне сховище
            const savedData = localStorage.getItem(`case_roulette_user_${this.user.id}`);
            
            if (savedData) {
                const data = JSON.parse(savedData);
                this.balance = data.balance || 0;
                this.totalWon = data.totalWon || 0;
                this.casesOpened = data.casesOpened || 0;
            } else {
                // Новий користувач
                this.balance = 0;
                this.totalWon = 0;
                this.casesOpened = 0;
                this.saveUserData();
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }
    
    // Збереження даних користувача
    saveUserData() {
        if (!this.user) return;
        
        const data = {
            balance: this.balance,
            totalWon: this.totalWon,
            casesOpened: this.casesOpened,
            lastPlayed: new Date().toISOString()
        };
        
        localStorage.setItem(`case_roulette_user_${this.user.id}`, JSON.stringify(data));
    }
    
    // Рендер кейсів
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
    
    // Рендер шансів виграшу
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
    
    // Відкриття кейса
    async openCase(caseItem) {
        if (this.isSpinning) return;
        
        // Перевірка балансу
        if (this.balance < caseItem.price) {
            this.showNotification(`Недостатньо Stars! Потрібно ${caseItem.price} ⭐`);
            this.buyStars();
            return;
        }
        
        // Віднімаємо вартість кейса
        this.balance -= caseItem.price;
        this.casesOpened++;
        this.updateUI();
        this.saveUserData();
        
        // Запускаємо анімацію
        this.isSpinning = true;
        this.startRoulette(caseItem);
    }
    
    // Розрахунок виграшу
    calculateReward(caseItem) {
        const random = Math.random();
        let accumulatedChance = 0;
        
        for (const reward of CONFIG.REWARDS) {
            accumulatedChance += reward.chance;
            if (random <= accumulatedChance) {
                // Застосовуємо множник кейса
                const finalStars = reward.stars * caseItem.multiplier;
                return {
                    ...reward,
                    finalStars: finalStars,
                    caseMultiplier: caseItem.multiplier
                };
            }
        }
        
        // Запасний варіант
        return {
            ...CONFIG.REWARDS[CONFIG.REWARDS.length - 1],
            finalStars: 0,
            caseMultiplier: caseItem.multiplier
        };
    }
    
    // Запуск рулетки
    startRoulette(caseItem) {
        const roulette = document.getElementById('roulette');
        const rouletteItems = document.getElementById('rouletteItems');
        
        // Показуємо рулетку
        roulette.style.display = 'block';
        document.querySelectorAll('.case').forEach(el => {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.5';
        });
        
        // Генеруємо елементи рулетки
        this.generateRouletteItems(rouletteItems, caseItem);
        
        // Розраховуємо виграш
        const reward = this.calculateReward(caseItem);
        
        // Знаходимо позицію виграшного елемента
        const itemWidth = 100;
        const totalItems = 100;
        const winningIndex = Math.floor(Math.random() * 30) + 35;
        const targetPosition = -(winningIndex * itemWidth) + 200;
        
        // Скидаємо анімацію
        rouletteItems.style.transition = 'none';
        rouletteItems.style.transform = 'translateX(0)';
        
        // Запускаємо анімацію
        setTimeout(() => {
            rouletteItems.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
            rouletteItems.style.transform = `translateX(${targetPosition}px)`;
        }, 50);
        
        // Показуємо результат
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
    
    // Генерація елементів рулетки
    generateRouletteItems(container, caseItem) {
        container.innerHTML = '';
        
        // Створюємо 100 елементів для плавної анімації
        for (let i = 0; i < 100; i++) {
            const item = document.createElement('div');
            item.className = 'roulette-item';
            
            // Випадково вибираємо тип нагороди
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
    
    // Показ результату
    showResult(reward, caseItem) {
        const resultOverlay = document.getElementById('resultOverlay');
        const resultIcon = document.getElementById('resultIcon');
        const resultText = document.getElementById('resultText');
        const resultAmount = document.getElementById('resultAmount');
        
        // Оновлюємо баланс при виграші
        if (reward.finalStars > 0) {
            this.balance += reward.finalStars;
            this.totalWon += reward.finalStars;
            
            // Анімація конфетті
            this.createConfetti();
        }
        
        // Оновлюємо інтерфейс
        this.updateUI();
        this.saveUserData();
        
        // Налаштовуємо відображення результату
        if (reward.finalStars > 0) {
            resultIcon.textContent = reward.icon;
            resultIcon.style.color = reward.color;
            resultText.textContent = '🎉 Вітаємо! Ви виграли:';
            resultAmount.textContent = `${reward.finalStars} ⭐`;
            resultAmount.style.color = reward.color;
            
            // Показуємо множник
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
        
        // Показуємо результат
        resultOverlay.style.display = 'flex';
    }
    
    // Закриття результату
    closeResult() {
        const resultOverlay = document.getElementById('resultOverlay');
        resultOverlay.style.display = 'none';
    }
    
    // Поділитися результатом
    shareResult() {
        if (window.Telegram?.WebApp) {
            const shareText = `Я виграв ${this.totalWon} Stars у Case Roulette! Спробуй і ти! 🎰`;
            Telegram.WebApp.share(shareText);
        } else {
            this.showNotification('Скопійовано в буфер обміну!');
            navigator.clipboard.writeText(`Я граю в Case Roulette! Спробуй і ти! 🎰`);
        }
    }
    
    // Показати статистику
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
    
    // Покупка Stars
    buyStars() {
        if (window.Telegram?.WebApp) {
            Telegram.WebApp.openInvoice({
                title: 'Купити Telegram Stars',
                description: 'Використовуйте Stars для відкриття кейсів',
                currency: 'stars',
                prices: [
                    { label: '10 Stars', amount: 10 },
                    { label: '50 Stars', amount: 50 },
                    { label: '100 Stars', amount: 100 },
                    { label: '500 Stars', amount: 500 }
                ]
            });
        } else {
            // Режим розробки
            this.showNotification('Режим розробки: +50 Stars');
            this.balance += 50;
            this.updateUI();
            this.saveUserData();
        }
    }
    
    // Обробка платежу
    handlePayment(event) {
        if (event.status === 'paid') {
            this.balance += event.amount;
            this.updateUI();
            this.saveUserData();
            
            this.showNotification(`Куплено ${event.amount} Stars! 🎉`);
            
            // Показуємо подяку
            setTimeout(() => {
                alert('Дякуємо за покупку! 🎉\n\nТепер ви можете відкривати більше кейсів!');
            }, 500);
        } else if (event.status === 'failed') {
            this.showNotification('Помилка оплати 😔 Спробуйте ще раз');
        }
    }
    
    // Оновлення інтерфейсу
    updateUI() {
        // Баланс
        const balanceElement = document.getElementById('balance');
        if (balanceElement) {
            balanceElement.textContent = this.balance;
        }
        
        // Статистика
        const casesCountElement = document.getElementById('casesCount');
        if (casesCountElement) {
            casesCountElement.textContent = this.casesOpened;
        }
        
        const totalWonElement = document.getElementById('totalWon');
        if (totalWonElement) {
            totalWonElement.textContent = this.totalWon;
        }
    }
    
    // Конфетті анімація
    createConfetti() {
        const confettiCount = 150;
        const container = document.querySelector('.container');
        
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
            
            // Анімація падіння
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
    
    // Показувати шанси
    showProbabilities() {
        const modal = document.getElementById('probabilitiesModal');
        modal.style.display = 'flex';
    }
    
    // Ховати шанси
    hideProbabilities() {
        const modal = document.getElementById('probabilitiesModal');
        modal.style.display = 'none';
    }
    
    // Показати сповіщення
    showNotification(message) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    // Показати завантаження
    showLoading(text) {
        const loading = document.getElementById('loading');
        const loadingText = document.getElementById('loadingText');
        
        loadingText.textContent = text || 'Завантаження...';
        loading.style.display = 'flex';
    }
    
    // Сховати завантаження
    hideLoading() {
        const loading = document.getElementById('loading');
        loading.style.display = 'none';
    }
}

// Глобальні функції для HTML
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
    if (game) game.buyStars();
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

// Запуск гри при завантаженні сторінки
window.addEventListener('DOMContentLoaded', initGame);

// Глобальний об'єкт для відладки
window.CaseRouletteGame = CaseRouletteGame;