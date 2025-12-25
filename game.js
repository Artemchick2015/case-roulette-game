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
    OWNER_ID: 6662507956,
    OWNER_USERNAME: 'Artemchixst',
    BOT_TOKEN: '8423883790:AAFemxHm60UVaSUKDjRwuoIUivQLp-ExzaQ' // Ваш токен
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
        this.paymentPayload = null;
        
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
                if (this.user && (this.user.id === CONFIG.OWNER_ID || 
                    this.user.username === CONFIG.OWNER_USERNAME)) {
                    this.isOwner = true;
                    console.log('👑 Власник гри зайшов!');
                }
                
                // Слухаємо події оплати WebApp
                Telegram.WebApp.onEvent('invoiceClosed', this.handlePayment.bind(this));
                
                console.log('Telegram WebApp ініціалізовано:', this.user);
                
            } catch (error) {
                console.error('Telegram init error:', error);
                this.user = { id: 0, username: 'test' };
            }
        } else {
            console.log('Development mode - no Telegram WebApp');
            this.user = { id: 0, username: 'test' };
            this.balance = 100;
        }
    }
    
    // ================== СИСТЕМА ОПЛАТИ ==================
    
    // Функція показу модального вікна для оплати
    showPaymentModal() {
        const existingModal = document.getElementById('paymentModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'paymentModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.97);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                       padding: 30px;
                       border-radius: 20px;
                       width: 100%;
                       max-width: 420px;
                       border: 2px solid rgba(255,215,0,0.3);
                       box-shadow: 0 20px 60px rgba(0,0,0,0.7);
                       position: relative;">
                
                <button onclick="window.game.closePaymentModal()" 
                        style="position: absolute; top: 15px; right: 15px; 
                               background: none; border: none; color: white; 
                               font-size: 24px; cursor: pointer;">×</button>
                
                <h2 style="text-align: center; margin-bottom: 25px; color: #ffd700; font-size: 26px;">
                    💰 Поповнення балансу
                </h2>
                
                <div style="margin-bottom: 25px;">
                    <label style="display: block; margin-bottom: 12px; opacity: 0.9; font-size: 16px;">
                        Скільки Telegram Stars ви хочете внести?
                    </label>
                    <input type="number" id="starsAmount" 
                           min="10" max="5000" value="100" step="10"
                           style="width: 100%;
                                  padding: 18px;
                                  border: 2px solid rgba(255,215,0,0.4);
                                  background: rgba(0,0,0,0.7);
                                  color: #ffd700;
                                  border-radius: 12px;
                                  font-size: 22px;
                                  text-align: center;
                                  font-weight: bold;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 15px;">
                        <button onclick="setPaymentAmount(50)" style="padding: 12px; background: linear-gradient(45deg, #667eea, #764ba2); border: none; color: white; border-radius: 8px; font-size: 14px; font-weight: bold;">50 ⭐</button>
                        <button onclick="setPaymentAmount(100)" style="padding: 12px; background: linear-gradient(45deg, #667eea, #764ba2); border: none; color: white; border-radius: 8px; font-size: 14px; font-weight: bold;">100 ⭐</button>
                        <button onclick="setPaymentAmount(500)" style="padding: 12px; background: linear-gradient(45deg, #667eea, #764ba2); border: none; color: white; border-radius: 8px; font-size: 14px; font-weight: bold;">500 ⭐</button>
                        <button onclick="setPaymentAmount(1000)" style="padding: 12px; background: linear-gradient(45deg, #667eea, #764ba2); border: none; color: white; border-radius: 8px; font-size: 14px; font-weight: bold;">1000 ⭐</button>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 25px 0; padding: 20px; background: rgba(255,215,0,0.15); border-radius: 12px; border: 1px solid rgba(255,215,0,0.3);">
                    <div style="font-size: 14px; opacity: 0.8; margin-bottom: 5px;">Приблизна вартість:</div>
                    <div style="font-size: 32px; font-weight: bold; color: #ffd700; text-shadow: 0 0 10px rgba(255,215,0,0.5);">
                        <span id="usdAmount">~$1.00</span> USD
                    </div>
                    <div style="font-size: 13px; opacity: 0.6; margin-top: 8px;">
                        1 Telegram Star = $0.01
                    </div>
                </div>
                
                <div style="display: flex; gap: 12px; margin-top: 25px;">
                    <button onclick="window.game.createTelegramInvoice()" 
                            style="flex: 1; 
                                   padding: 18px; 
                                   background: linear-gradient(45deg, #4CAF50, #2E7D32);
                                   border: none; 
                                   color: white; 
                                   border-radius: 12px; 
                                   font-size: 18px; 
                                   font-weight: bold;
                                   cursor: pointer;
                                   transition: all 0.3s;
                                   box-shadow: 0 5px 15px rgba(76, 175, 80, 0.3);">
                        💳 Створити чек
                    </button>
                    <button onclick="window.game.closePaymentModal()" 
                            style="flex: 1; 
                                   padding: 18px; 
                                   background: rgba(255,255,255,0.1);
                                   border: 2px solid rgba(255,255,255,0.3);
                                   color: white; 
                                   border-radius: 12px; 
                                   font-size: 18px;
                                   cursor: pointer;
                                   transition: all 0.3s;">
                        Скасувати
                    </button>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.5); border-radius: 10px; font-size: 13px; opacity: 0.7; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                    ⚡ Оплата через Telegram Stars. Після оплати зірки автоматично з'являться у грі.
                </div>
                
                <!-- Індикатор для власника -->
                ${this.isOwner ? '<div style="margin-top: 15px; padding: 10px; background: rgba(255,215,0,0.1); border-radius: 8px; text-align: center; font-size: 12px; color: #ffd700;">👑 Ви власник - отримаєте зірки безкоштовно</div>' : ''}
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Оновлюємо USD еквівалент
        const starsInput = document.getElementById('starsAmount');
        const usdAmount = document.getElementById('usdAmount');
        
        const updateUsd = () => {
            const stars = parseInt(starsInput.value) || 0;
            const usd = (stars * 0.01).toFixed(2);
            usdAmount.textContent = `~$${usd}`;
        };
        
        starsInput.addEventListener('input', updateUsd);
        starsInput.addEventListener('change', updateUsd);
        
        // Початкове значення
        updateUsd();
        
        // Фокус на інпут
        setTimeout(() => {
            if (starsInput) starsInput.focus();
            starsInput.select();
        }, 100);
    }
    
    // Головна функція створення чеку
    async createTelegramInvoice() {
        const starsInput = document.getElementById('starsAmount');
        if (!starsInput) {
            this.showNotification('❌ Помилка: поле для вводу не знайдено');
            return;
        }
        
        const amount = parseInt(starsInput.value);
        
        if (!amount || amount < 10) {
            this.showNotification('❌ Мінімальна сума: 10 Stars');
            return;
        }
        
        if (amount > 5000) {
            this.showNotification('❌ Максимальна сума: 5,000 Stars');
            return;
        }
        
        this.paymentAmount = amount;
        this.paymentPayload = `payment_${this.user?.id || 'guest'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('🔄 Створення чеку на', amount, 'Stars, payload:', this.paymentPayload);
        
        // Для власника - безкоштовне поповнення
        if (this.isOwner) {
            this.closePaymentModal();
            this.showLoading('👑 Отримуємо зірки безкоштовно...');
            
            setTimeout(() => {
                this.balance += amount;
                this.updateUI();
                this.saveUserData();
                this.hideLoading();
                this.showNotification(`👑 Власник отримав ${amount} Stars безкоштовно!`);
                this.createConfetti();
                
                // Повідомлення про успіх
                if (window.Telegram?.WebApp) {
                    Telegram.WebApp.showAlert(`✅ Отримано ${amount} Stars!\n\n👑 Ви власник гри, тому зірки нараховані безкоштовно.`);
                }
            }, 1500);
            return;
        }
        
        // Перевірка чи ми в Telegram WebApp
        if (!window.Telegram?.WebApp) {
            this.closePaymentModal();
            this.showNotification('⚠️ Оплата доступна тільки в Telegram');
            alert('Для тестування оплати запустіть гру через Telegram бота:\nhttps://t.me/xstgifts_bot');
            return;
        }
        
        try {
            // ВАЖЛИВО: Правильні параметри для Telegram Stars
            const invoiceParams = {
                title: `Case Roulette | ${amount} Stars`,
                description: `Поповнення балансу в грі Case Roulette. Після оплати ${amount} Telegram Stars будуть додані до вашого балансу.`,
                currency: 'XTR', // Валюта Telegram Stars
                prices: [
                    {
                        label: `${amount} Telegram Stars`,
                        amount: amount // 1 Star = 1 одиниця валюти XTR
                    }
                ],
                payload: this.paymentPayload,
                // provider_token: "", // ДЛЯ TELEGRAM STARS ЗАЛИШАЄМО ПУСТИМ АБО ВИДАЛЯЄМО
                photo_url: 'https://xstgifts.vercel.app/star-icon.png',
                photo_size: 256,
                photo_width: 256,
                photo_height: 256,
                need_name: false,
                need_phone_number: false,
                need_email: false,
                need_shipping_address: false,
                is_flexible: false,
                send_phone_number_to_provider: false,
                send_email_to_provider: false
            };
            
            console.log('📱 Відкриваємо чек з параметрами:', invoiceParams);
            
            // Відкриваємо платіжну форму
            Telegram.WebApp.openInvoice(invoiceParams);
            
            this.closePaymentModal();
            
        } catch (error) {
            console.error('❌ Критична помилка створення чеку:', error);
            this.showNotification('❌ Помилка створення чеку. Спробуйте ще раз.');
            
            // Альтернативний спосіб через Bot API
            this.tryAlternativePayment(amount);
        }
    }
    
    // Альтернативний спосіб оплати через Bot API
    async tryAlternativePayment(amount) {
        console.log('🔄 Спробуємо альтернативний спосіб оплати...');
        
        // Якщо у нас є токен бота, можемо спробувати через Bot API
        if (CONFIG.BOT_TOKEN && this.user?.id) {
            try {
                // Відправляємо запит на наш сервер для створення чеку
                const response = await fetch('https://api.telegram.org/bot' + CONFIG.BOT_TOKEN + '/sendInvoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: this.user.id,
                        title: `Case Roulette | ${amount} Stars`,
                        description: `Поповнення балансу в грі Case Roulette`,
                        payload: `payment_${this.user.id}_${Date.now()}`,
                        provider_token: "", // Пусто для Telegram Stars
                        currency: 'XTR',
                        prices: [{ label: `${amount} Stars`, amount: amount }],
                        photo_url: 'https://xstgifts.vercel.app/star-icon.png',
                        photo_size: 256,
                        photo_width: 256,
                        photo_height: 256
                    })
                });
                
                const data = await response.json();
                console.log('Bot API відповідь:', data);
                
                if (data.ok) {
                    this.showNotification('✅ Чек відправлено в Telegram! Перевірте чат з ботом.');
                } else {
                    throw new Error(data.description);
                }
                
            } catch (error) {
                console.error('Помилка Bot API:', error);
                this.showNotification('❌ Не вдалося створити чек. Спробуйте пізніше.');
            }
        }
    }
    
    closePaymentModal() {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.remove();
        }
    }
    
    // Обробка платежу від Telegram WebApp
    async handlePayment(event) {
        console.log('💰 Подія оплати отримана:', event);
        
        if (!event) {
            console.error('Пуста подія оплати');
            return;
        }
        
        // Детальна інформація про подію
        console.log('Деталі події:', {
            status: event.status,
            slug: event.slug,
            payload: event.payload,
            amount: event.amount,
            currency: event.currency
        });
        
        // Обробка різних статусів
        switch(event.status) {
            case 'paid':
                this.processSuccessfulPayment(event);
                break;
                
            case 'failed':
                this.showNotification('❌ Оплата не вдалася. Спробуйте ще раз.');
                console.error('Помилка оплати:', event);
                break;
                
            case 'pending':
                this.showNotification('⏳ Платіж обробляється...');
                break;
                
            case 'cancelled':
                this.showNotification('🚫 Оплату скасовано');
                break;
                
            default:
                console.log('Невідомий статус оплати:', event.status);
                this.showNotification('ℹ️ Статус оплати: ' + event.status);
        }
    }
    
    // Обробка успішної оплати
    async processSuccessfulPayment(event) {
        const amount = this.paymentAmount || event.amount || 100;
        const payload = event.payload || this.paymentPayload;
        
        console.log(`✅ Оплата успішна! Сума: ${amount}, Payload: ${payload}`);
        
        // Показуємо завантаження
        this.showLoading('💫 Завантажуємо зірки...');
        
        // Нараховуємо зірки
        setTimeout(() => {
            this.balance += amount;
            this.updateUI();
            this.saveUserData();
            this.hideLoading();
            
            // Показуємо успіх
            this.showNotification(`🎉 Успішно! +${amount} Stars зараховано!`);
            this.createConfetti();
            
            // Додаткове сповіщення
            setTimeout(() => {
                if (window.Telegram?.WebApp) {
                    Telegram.WebApp.showAlert(
                        `✅ Оплата успішна!\n\n` +
                        `💎 Отримано: ${amount} Telegram Stars\n` +
                        `💰 Вартість: ~$${(amount * 0.01).toFixed(2)} USD\n` +
                        `🎮 Новый баланс: ${this.balance} Stars\n\n` +
                        `Гарної гри! 🎰`
                    );
                }
            }, 300);
            
            // Відправляємо сповіщення власнику
            this.sendPaymentNotification(amount);
            
            // Скидаємо дані платежу
            this.paymentAmount = 0;
            this.paymentPayload = null;
            
        }, 2000);
    }
    
    // Відправка сповіщення власнику
    async sendPaymentNotification(amount) {
        if (!this.user || this.isOwner) return;
        
        try {
            const usdAmount = (amount * 0.01).toFixed(2);
            const message = 
                `💰 *НОВИЙ ДОНАТ У ГРІ* 🎰\n\n` +
                `👤 Від: ${this.user.username ? `@${this.user.username}` : `ID: ${this.user.id}`}\n` +
                `💎 Сума: ${amount} Telegram Stars\n` +
                `💵 Еквівалент: ~$${usdAmount} USD\n` +
                `🎮 Гра: Case Roulette\n` +
                `⏰ Час: ${new Date().toLocaleString('uk-UA')}`;
            
            // Відправляємо через Bot API
            await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CONFIG.OWNER_ID,
                    text: message,
                    parse_mode: 'Markdown'
                })
            });
            
            console.log('📢 Сповіщення власнику відправлено');
            
        } catch (error) {
            console.error('Помилка відправки сповіщення:', error);
        }
    }
    
    // ================== ІНШІ МЕТОДИ ==================
    
    async loadUserData() {
        try {
            if (!this.user) return;
            
            // Для власника - безкоштовні зірки
            if (this.isOwner) {
                this.balance = 999999;
                this.totalWon = 0;
                this.casesOpened = 0;
                this.saveUserData();
                
                // Показуємо бейдж власника
                setTimeout(() => {
                    const ownerBadge = document.getElementById('ownerBadge');
                    if (ownerBadge) ownerBadge.style.display = 'block';
                }, 100);
                return;
            }
            
            const savedData = localStorage.getItem(`case_roulette_user_${this.user.id}`);
            
            if (savedData) {
                const data = JSON.parse(savedData);
                this.balance = data.balance || 0;
                this.totalWon = data.totalWon || 0;
                this.casesOpened = data.casesOpened || 0;
            } else {
                this.balance = 10; // Бонус за реєстрацію
                this.totalWon = 0;
                this.casesOpened = 0;
                this.saveUserData();
                
                // Сповіщення про нового користувача
                this.sendNewUserNotification();
                
                this.showNotification('🎁 Новому користувачу +10 бонусних Stars!');
                this.updateUI();
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }
    
    async sendNewUserNotification() {
        if (!this.user || this.isOwner) return;
        
        try {
            const message = 
                `🆕 *НОВИЙ КОРИСТУВАЧ У ГРІ* 🎮\n\n` +
                `👤 ID: ${this.user.id}\n` +
                `📛 Ім'я: ${this.user.first_name || '-'} ${this.user.last_name || '-'}\n` +
                `🔗 Юзернейм: @${this.user.username || 'немає'}\n` +
                `🌐 Мова: ${this.user.language_code || 'немає'}\n` +
                `🎰 Гра: Case Roulette\n` +
                `🎁 Бонус: 10 Stars\n` +
                `📅 Час: ${new Date().toLocaleString('uk-UA')}`;
            
            await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CONFIG.OWNER_ID,
                    text: message,
                    parse_mode: 'Markdown'
                })
            });
            
            console.log('📢 Сповіщення про нового користувача відправлено');
            
        } catch (error) {
            console.error('Помилка відправки сповіщення:', error);
        }
    }
    
    saveUserData() {
        if (!this.user || this.isOwner) return;
        
        const data = {
            balance: this.balance,
            totalWon: this.totalWon,
            casesOpened: this.casesOpened,
            lastPlayed: new Date().toISOString(),
            username: this.user.username
        };
        
        localStorage.setItem(`case_roulette_user_${this.user.id}`, JSON.stringify(data));
    }
    
    renderCases() {
        const container = document.getElementById('casesContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        CONFIG.SPECIAL_CASES.forEach(caseItem => {
            const caseElement = document.createElement('div');
            caseElement.className = 'case';
            caseElement.style.setProperty('--case-color', caseItem.color);
            caseElement.dataset.id = caseItem.id;
            
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
    
    openCase(caseItem) {
        if (this.isSpinning) return;
        
        if (this.balance < caseItem.price) {
            this.showNotification(`Недостатньо Stars! Потрібно ${caseItem.price} ⭐`);
            this.showPaymentModal();
            return;
        }
        
        this.balance -= caseItem.price;
        this.casesOpened++;
        this.saveUserData();
        this.updateUI();
        
        this.isSpinning = true;
        this.startRoulette(caseItem);
    }
    
    startRoulette(caseItem) {
        const roulette = document.getElementById('roulette');
        const rouletteItems = document.getElementById('rouletteItems');
        
        if (!roulette || !rouletteItems) return;
        
        roulette.style.display = 'block';
        document.querySelectorAll('.case').forEach(el => {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.5';
        });
        
        // Генеруємо випадковий результат
        const reward = this.calculateReward(caseItem);
        this.generateRouletteWithResult(rouletteItems, caseItem, reward.finalStars);
        
        const itemWidth = 100;
        const winningIndex = Math.floor(Math.random() * 30) + 35;
        const targetPosition = -(winningIndex * itemWidth) + 200;
        
        rouletteItems.style.transition = 'none';
        rouletteItems.style.transform = 'translateX(0)';
        
        setTimeout(() => {
            rouletteItems.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
            rouletteItems.style.transform = `translateX(${targetPosition}px)`;
        }, 50);
        
        setTimeout(() => {
            this.showRouletteResult(reward, caseItem);
            this.isSpinning = false;
            roulette.style.display = 'none';
            
            document.querySelectorAll('.case').forEach(el => {
                el.style.pointerEvents = 'auto';
                el.style.opacity = '1';
            });
        }, 3500);
    }
    
    showRouletteResult(reward, caseItem) {
        const resultOverlay = document.getElementById('resultOverlay');
        const resultIcon = document.getElementById('resultIcon');
        const resultText = document.getElementById('resultText');
        const resultAmount = document.getElementById('resultAmount');
        
        if (!resultOverlay || !resultIcon || !resultText || !resultAmount) return;
        
        if (reward.finalStars > 0) {
            this.balance += reward.finalStars;
            this.totalWon += reward.finalStars;
            this.createConfetti();
            
            resultIcon.textContent = reward.icon;
            resultIcon.style.color = reward.color;
            resultText.innerHTML = '🎉 Вітаємо!<br>Ви виграли:';
            resultAmount.textContent = `${reward.finalStars} ⭐`;
            resultAmount.style.color = reward.color;
            
            if (caseItem.multiplier > 1) {
                resultText.innerHTML += `<br><small>(Множник: x${caseItem.multiplier})</small>`;
            }
            
            this.showNotification(`🎊 Ви виграли ${reward.finalStars} Stars!`);
        } else {
            resultIcon.textContent = '💨';
            resultIcon.style.color = '#95A5A6';
            resultText.textContent = '😔 Наступного разу пощастить!';
            resultAmount.textContent = '0 ⭐';
            resultAmount.style.color = '#95A5A6';
            
            this.showNotification('💪 Спробуйте ще раз!');
        }
        
        this.updateUI();
        this.saveUserData();
        resultOverlay.style.display = 'flex';
    }
    
    generateRouletteWithResult(container, caseItem, winAmount) {
        if (!container) return;
        
        container.innerHTML = '';
        
        // Створюємо 50 елементів
        for (let i = 0; i < 50; i++) {
            const item = document.createElement('div');
            item.className = 'roulette-item';
            
            // Генеруємо випадкову нагороду
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
            
            // Якщо це позиція виграшу, показуємо виграшну суму
            const displayAmount = (i === 25) ? winAmount : (rewardType.stars * caseItem.multiplier);
            
            item.innerHTML = `
                <div class="roulette-item-icon" style="color: ${rewardType.color}">
                    ${rewardType.icon}
                </div>
                <div class="roulette-item-amount">
                    ${displayAmount}
                </div>
            `;
            
            container.appendChild(item);
        }
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
    
    updateUI() {
        const balanceElement = document.getElementById('balance');
        if (balanceElement) {
            balanceElement.textContent = this.balance;
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
            confetti.style.opacity = '0.9';
            confetti.style.zIndex = '9999';
            confetti.style.pointerEvents = 'none';
            confetti.style.textShadow = '0 0 5px rgba(255,255,255,0.5)';
            
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
    
    showNotification(message) {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    showLoading(text) {
        const loading = document.getElementById('loading');
        const loadingText = document.getElementById('loadingText');
        
        if (!loading || !loadingText) return;
        
        loadingText.textContent = text || 'Завантаження...';
        loading.style.display = 'flex';
    }
    
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }
    
    // Функції для власника
    addStars(amount) {
        if (!this.isOwner) return;
        
        this.balance += amount;
        this.updateUI();
        this.saveUserData();
        this.showNotification(`👑 Власнику додано ${amount} Stars!`);
        this.createConfetti();
        
        const menu = document.getElementById('ownerMenu');
        if (menu) menu.classList.remove('show');
    }
    
    resetStats() {
        if (!this.isOwner) return;
        
        if (window.Telegram?.WebApp && Telegram.WebApp.showConfirm) {
            Telegram.WebApp.showConfirm(
                'Скинути всю статистику гри?',
                'Ця дія видалить всі дані користувачів.',
                (confirmed) => {
                    if (confirmed) {
                        localStorage.clear();
                        this.balance = 999999;
                        this.totalWon = 0;
                        this.casesOpened = 0;
                        this.updateUI();
                        this.showNotification('📊 Статистику скинуто!');
                        
                        const menu = document.getElementById('ownerMenu');
                        if (menu) menu.classList.remove('show');
                    }
                }
            );
        } else if (confirm('Скинути всю статистику гри?')) {
            localStorage.clear();
            this.balance = 999999;
            this.totalWon = 0;
            this.casesOpened = 0;
            this.updateUI();
            this.showNotification('📊 Статистику скинуто!');
            
            const menu = document.getElementById('ownerMenu');
            if (menu) menu.classList.remove('show');
        }
    }
}

// ================== ГЛОБАЛЬНІ ФУНКЦІЇ ==================

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

function setPaymentAmount(amount) {
    const input = document.getElementById('starsAmount');
    if (input) {
        input.value = amount;
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
    }
}

function toggleOwnerMenu() {
    const menu = document.getElementById('ownerMenu');
    if (menu) {
        menu.classList.toggle('show');
    }
}

// Запуск гри
window.addEventListener('DOMContentLoaded', initGame);

// Експорт для глобального використання
window.CaseRouletteGame = CaseRouletteGame;
window.closeResult = closeResult;
window.shareResult = shareResult;
window.buyStars = buyStars;
window.showStats = showStats;
window.showProbabilities = showProbabilities;
window.hideProbabilities = hideProbabilities;
window.setPaymentAmount = setPaymentAmount;
window.toggleOwnerMenu = toggleOwnerMenu;
