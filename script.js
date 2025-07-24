// Firebase Configuration
// You'll need to replace these with your actual Firebase project credentials
const firebaseConfig = {
    // Replace these with your actual Firebase config values
    apiKey: "AIzaSyCDsUyaBOIoCj8Ntd14-89s69-TMarwovo",
    authDomain: "wibi-studio.firebaseapp.com",
    projectId: "wibi-studio",
    storageBucket: "wibi-studio.firebasestorage.app",
    messagingSenderId: "768544174035",
    appId: "1:768544174035:web:df20739e8426043c94c926",
    measurementId: "G-Z4QYNGK9PJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Google Auth Provider
const provider = new firebase.auth.GoogleAuthProvider();

// Mystery Box E-commerce Application
class MysteryBoxApp {
    constructor() {
        this.user = null;
        this.username = null;
        this.userBalance = 1000;
        this.inventory = [];
        this.authUnsubscribe = null; // Track auth listener
        this.isPromptingUsername = false; // Prevent multiple username prompts
        this.pendingUsername = null; // Store username for registration
        this.leaderboardData = {
            daily: [],
            weekly: [],
            alltime: []
        };
        this.rarityColors = {
            common: '#9ca3af',
            rare: '#3b82f6',
            epic: '#8b5cf6',
            legendary: '#f59e0b',
            mythic: '#ef4444'
        };
        
        // Wait for Firebase to initialize before setting up auth listener
        this.initializeApp();
    }

    async initializeApp() {
        try {
            // Wait for Firebase Auth to be ready
            await new Promise((resolve) => {
                const unsubscribe = auth.onAuthStateChanged(() => {
                    unsubscribe();
                    resolve();
                });
            });
            
            // Only initialize the auth listener once here
            this.initAuthListener();
            this.init();
            this.generateSampleData();
        } catch (error) {
            console.error('Error initializing app:', error);
            // Fallback to basic initialization
            this.init();
            this.generateSampleData();
        }
    }

    // Firebase Authentication Methods
    initAuthListener() {
        // Ensure we only have one listener
        if (this.authUnsubscribe) {
            this.authUnsubscribe();
        }
        
        // Store the unsubscribe function to prevent multiple listeners
        this.authUnsubscribe = auth.onAuthStateChanged(async (user) => {
            console.log('Auth state changed:', user ? user.email : 'logged out');
            this.user = user;
            
            if (user) {
                console.log('User logged in:', user.email);
                try {
                    // Check if we have a pending username from registration
                    if (this.pendingUsername) {
                        console.log('Creating user document with pending username:', this.pendingUsername);
                        await this.createUserDocumentWithUsername(this.pendingUsername);
                        this.pendingUsername = null;
                    } else {
                        console.log('Loading existing user data');
                        await this.loadUserData();
                    }
                    console.log('Username after loading data:', this.username);
                    this.showUserInterface();
                } catch (error) {
                    console.error('Error in auth state change:', error);
                    // Don't set fallback username - let loadUserData handle it
                    this.showUserInterface();
                }
            } else {
                console.log('User logged out');
                this.showAuthInterface();
                this.resetToDefaults();
            }
        });
    }

    async loadUserData() {
        // Add check to ensure user exists
        if (!this.user) {
            console.log('No user found, skipping loadUserData');
            return;
        }

        try {
            console.log('Loading user data for:', this.user.uid);
            const userDoc = await db.collection('users').doc(this.user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                console.log('User data from Firestore:', userData);
                
                // Load balance and inventory first
                this.userBalance = userData.balance || 1000;
                this.inventory = userData.inventory || [];
                
                // Check if user has a proper username (not email-based)
                if (userData.username && !userData.username.includes('@') && userData.username.trim() !== '') {
                    this.username = userData.username;
                    console.log('Set username to:', this.username);
                    // Update display immediately after setting username
                    this.updateUsernameDisplay();
                } else {
                    console.log('No valid username found, prompting user to set one');
                    // Prompt for username but don't block the UI
                    this.promptForUsername().then(() => {
                        this.updateUsernameDisplay();
                    }).catch(error => {
                        console.error('Error prompting for username:', error);
                    });
                }
            } else {
                console.log('No user document found, creating new one');
                // Set defaults first
                this.userBalance = 1000;
                this.inventory = [];
                // Then prompt for username
                this.promptForUsername().then(() => {
                    this.updateUsernameDisplay();
                }).catch(error => {
                    console.error('Error prompting for username:', error);
                });
            }
            
            // Update displays immediately with current data
            this.updateBalanceDisplay();
            this.updateInventoryDisplay();
            this.updateUsernameDisplay();
            
        } catch (error) {
            console.error('Error loading user data:', error);
            
            // Set fallback values but don't set username fallback
            this.userBalance = 1000;
            this.inventory = [];
            // Don't set username here - let it remain null until properly set
            this.updateBalanceDisplay();
            this.updateInventoryDisplay();
            this.updateUsernameDisplay();
        }
    }

    updateUsernameDisplay() {
        const displayElement = document.getElementById('user-display-name');
        console.log('Updating username display. Username:', this.username);
        console.log('Display element found:', !!displayElement);
        
        if (displayElement) {
            // Show appropriate username based on state
            if (this.isPromptingUsername) {
                displayElement.textContent = 'Setting username...';
            } else if (this.username) {
                displayElement.textContent = this.username;
            } else if (this.user && !this.username) {
                displayElement.textContent = 'Loading username...';
            } else {
                displayElement.textContent = 'Guest User';
            }
            console.log('Setting display name to:', displayElement.textContent);
        }
    }

    async promptForUsername() {
        // Prevent multiple username prompts
        if (this.isPromptingUsername) {
            console.log('Already prompting for username, skipping');
            return;
        }
        
        this.isPromptingUsername = true;
        this.updateUsernameDisplay(); // Update display to show "Setting username..."
        
        return new Promise((resolve) => {
            // Check if modal already exists
            const existingModal = document.querySelector('.username-modal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // Create username prompt modal
            const modal = document.createElement('div');
            modal.className = 'modal active username-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h2>Choose Your Username</h2>
                    <p>Please choose a unique username to continue:</p>
                    <div class="form-group">
                        <input type="text" id="username-input" placeholder="Enter username (3-20 characters)" maxlength="20" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin: 10px 0;">
                        <div id="username-error" style="color: red; font-size: 14px; margin-top: 5px;"></div>
                    </div>
                    <div class="form-actions" style="margin-top: 20px;">
                        <button id="set-username-btn" class="btn btn-primary" style="width: 100%; padding: 12px;">Set Username</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const input = modal.querySelector('#username-input');
            const errorDiv = modal.querySelector('#username-error');
            const setBtn = modal.querySelector('#set-username-btn');
            
            // Focus on input
            setTimeout(() => input.focus(), 100);
            
            const handleSetUsername = async () => {
                const username = input.value.trim();
                
                // Validate username
                if (!username) {
                    errorDiv.textContent = 'Username cannot be empty';
                    return;
                }
                
                if (username.length < 3) {
                    errorDiv.textContent = 'Username must be at least 3 characters';
                    return;
                }
                
                if (username.includes('@')) {
                    errorDiv.textContent = 'Username cannot contain @ symbol';
                    return;
                }
                
                if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
                    errorDiv.textContent = 'Username can only contain letters, numbers, underscores, and dashes';
                    return;
                }
                
                try {
                    setBtn.disabled = true;
                    setBtn.textContent = 'Checking...';
                    
                    // Check if username is already taken
                    const usernameQuery = await db.collection('users').where('username', '==', username).get();
                    if (!usernameQuery.empty) {
                        errorDiv.textContent = 'Username is already taken';
                        setBtn.disabled = false;
                        setBtn.textContent = 'Set Username';
                        return;
                    }
                    
                    // Set username
                    this.username = username;
                    
                    // Create or update user document
                    const userDocRef = db.collection('users').doc(this.user.uid);
                    const userDoc = await userDocRef.get();
                    
                    if (userDoc.exists) {
                        await userDocRef.update({
                            username: username,
                            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    } else {
                        await this.createUserDocumentWithUsername(username);
                    }
                    
                    // Update display immediately
                    this.isPromptingUsername = false;
                    this.updateUsernameDisplay();
                    
                    // Remove modal
                    document.body.removeChild(modal);
                    this.showNotification('Username set successfully!', 'success');
                    resolve();
                    
                } catch (error) {
                    console.error('Error setting username:', error);
                    errorDiv.textContent = 'Error setting username. Please try again.';
                    setBtn.disabled = false;
                    setBtn.textContent = 'Set Username';
                }
            };
            
            setBtn.addEventListener('click', handleSetUsername);
            
            // Allow Enter key to submit
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleSetUsername();
                }
            });
            
            // Clear error when typing
            input.addEventListener('input', () => {
                errorDiv.textContent = '';
            });
            
            // Prevent closing modal without setting username
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.showNotification('Please set a username to continue', 'error');
                }
            });
        });
    }

    async createUserDocumentWithUsername(username) {
        try {
            await db.collection('users').doc(this.user.uid).set({
                email: this.user.email,
                username: username,
                balance: this.userBalance || 1000,
                inventory: this.inventory || [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Set the username locally after successful save
            this.username = username;
            console.log('User document created successfully with username:', username);
            
            // Update display immediately
            this.updateUsernameDisplay();
            
        } catch (error) {
            console.error('Error creating user document:', error);
            // Don't throw error - just log it
        }
    }

    async saveUserData() {
        if (!this.user) return;
        
        try {
            await db.collection('users').doc(this.user.uid).update({
                balance: this.userBalance,
                inventory: this.inventory,
                username: this.username,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    }

    showUserInterface() {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('user-section').style.display = 'flex';
        document.getElementById('user-balance-section').style.display = 'flex';
        
        // Ensure username is displayed
        this.updateUsernameDisplay();
    }

    showAuthInterface() {
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('user-section').style.display = 'none';
        document.getElementById('user-balance-section').style.display = 'none';
    }

    resetToDefaults() {
        this.userBalance = 1000;
        this.inventory = [];
        this.username = null;
        this.isPromptingUsername = false;
        this.updateBalanceDisplay();
        this.updateInventoryDisplay();
        this.updateUsernameDisplay();
    }

    init() {
        this.updateBalanceDisplay();
        this.generateLeaderboards();
        this.generateSampleInventory();
        this.setupEventListeners();
        this.startParticleAnimation();
        this.updateStats();
    }

    setupEventListeners() {
        // Authentication buttons
        document.getElementById('login-btn').addEventListener('click', () => {
            this.showLoginModal();
        });

        document.getElementById('register-btn').addEventListener('click', () => {
            this.showRegisterModal();
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logoutUser();
        });

        // Add credits button
        document.getElementById('add-credits').addEventListener('click', () => {
            if (!this.user) {
                this.showNotification('Please login to purchase credits', 'error');
                return;
            }
            this.showCreditModal();
        });

        // Close modal on outside click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
                this.closeCreditModal();
                this.closeAuthModal();
            }
        });

        // Smooth scrolling for navigation
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    // Box opening mechanics
    openBox(type, price) {
        if (!this.user) {
            this.showNotification('Please login to open mystery boxes!', 'error');
            this.showLoginModal();
            return;
        }

        if (this.userBalance < price) {
            this.showNotification('Insufficient credits!', 'error');
            return;
        }

        this.userBalance -= price;
        this.updateBalanceDisplay();
        this.showOpeningAnimation(type, price);
    }

    showOpeningAnimation(type, price) {
        const modal = document.getElementById('opening-modal');
        const openingBox = document.getElementById('opening-box');
        const revealResult = document.getElementById('reveal-result');
        
        modal.classList.add('active');
        openingBox.style.display = 'block';
        revealResult.style.display = 'none';

        // Reset animations
        openingBox.classList.remove('opened');
        
        setTimeout(() => {
            this.revealItem(type, price);
        }, 3500);
    }

    revealItem(type, price) {
        const openingBox = document.getElementById('opening-box');
        const revealResult = document.getElementById('reveal-result');
        
        openingBox.style.display = 'none';
        revealResult.style.display = 'block';

        const item = this.generateRandomItem(type, price);
        this.displayRevealedItem(item);
        this.addToInventory(item);
        this.updateLeaderboard(item);
    }

    generateRandomItem(type, price) {
        const items = this.getItemPool(type);
        const rarity = this.determineRarity(type, price);
        let filteredItems = items.filter(item => item.rarity === rarity);
        
        // Fallback: if no items of the determined rarity exist, get any item from the pool
        if (filteredItems.length === 0) {
            console.warn(`No items found for rarity ${rarity} in ${type} pool, using fallback`);
            filteredItems = items.filter(item => item.rarity === 'common');
            if (filteredItems.length === 0) {
                filteredItems = items; // Ultimate fallback
            }
        }
        
        const selectedItem = filteredItems[Math.floor(Math.random() * filteredItems.length)];
        
        // Ensure we have a valid item
        if (!selectedItem) {
            console.error(`No item could be selected from ${type} pool`);
            return {
                name: 'Mystery Item',
                type: type,
                rarity: 'common',
                value: 10,
                icon: '❓',
                description: 'A mysterious item appeared!',
                id: Date.now() + Math.random(),
                unboxedAt: new Date()
            };
        }
        
        return {
            ...selectedItem,
            id: Date.now() + Math.random(),
            unboxedAt: new Date()
        };
    }

    determineRarity(type, price) {
        const random = Math.random() * 100;
        
        if (type === 'premium') {
            if (random < 5) return 'mythic';
            if (random < 25) return 'legendary';
            if (random < 60) return 'epic';
            return 'rare';
        }
        
        // Standard rarity distribution
        if (random < 2) return 'legendary';
        if (random < 10) return 'epic';
        if (random < 35) return 'rare';
        return 'common';
    }

    getItemPool(type) {
        const itemPools = {
            sneaker: [
                // Common
                { name: 'Air Runner Basic', type: 'sneaker', rarity: 'common', value: 25, icon: '👟', description: 'A basic running shoe for everyday wear.' },
                { name: 'Classic Canvas', type: 'sneaker', rarity: 'common', value: 30, icon: '👟', description: 'Timeless canvas sneakers.' },
                { name: 'Street Walker', type: 'sneaker', rarity: 'common', value: 20, icon: '👟', description: 'Comfortable street shoes.' },
                { name: 'Gym Trainer Pro', type: 'sneaker', rarity: 'common', value: 35, icon: '👟', description: 'Professional training shoes for fitness.' },
                { name: 'Urban Explorer', type: 'sneaker', rarity: 'common', value: 28, icon: '👟', description: 'Versatile city walking sneakers.' },
                
                // Rare
                { name: 'Air Jordan Retro', type: 'sneaker', rarity: 'rare', value: 150, icon: '👟', description: 'Classic basketball heritage.' },
                { name: 'Nike Dunk Limited', type: 'sneaker', rarity: 'rare', value: 180, icon: '👟', description: 'Limited edition colorway.' },
                { name: 'Adidas Boost Elite', type: 'sneaker', rarity: 'rare', value: 160, icon: '👟', description: 'Premium comfort technology.' },
                { name: 'Yeezy 350 V2', type: 'sneaker', rarity: 'rare', value: 220, icon: '👟', description: 'Kanye West designed comfort.' },
                { name: 'Converse Chuck 70', type: 'sneaker', rarity: 'rare', value: 140, icon: '👟', description: 'Premium vintage basketball style.' },
                
                // Epic
                { name: 'Off-White x Nike', type: 'sneaker', rarity: 'epic', value: 800, icon: '👟', description: 'Designer collaboration piece.' },
                { name: 'Travis Scott Jordan', type: 'sneaker', rarity: 'epic', value: 1200, icon: '👟', description: 'Artist collaboration sneaker.' },
                { name: 'Fear of God Essentials', type: 'sneaker', rarity: 'epic', value: 900, icon: '👟', description: 'Luxury streetwear design.' },
                
                // Legendary
                { name: 'Air Jordan 1 Chicago', type: 'sneaker', rarity: 'legendary', value: 3000, icon: '👟', description: 'Original colorway legend.' },
                { name: 'Nike Mag Self-Lacing', type: 'sneaker', rarity: 'legendary', value: 5000, icon: '👟', description: 'Future technology sneaker.' }
            ],
            
            nft: [
                // Common
                { name: 'Pixel Avatar #1234', type: 'nft', rarity: 'common', value: 0.1, icon: '🖼️', description: 'Basic pixel art avatar.' },
                { name: 'Digital Landscape', type: 'nft', rarity: 'common', value: 0.08, icon: '🖼️', description: 'AI-generated landscape.' },
                { name: 'Abstract Pattern', type: 'nft', rarity: 'common', value: 0.05, icon: '🖼️', description: 'Geometric art piece.' },
                { name: 'Cat Meme Collection', type: 'nft', rarity: 'common', value: 0.12, icon: '🐱', description: 'Funny cat digital art.' },
                { name: 'Retro Pixel Art', type: 'nft', rarity: 'common', value: 0.09, icon: '🎮', description: '8-bit style gaming art.' },
                
                // Rare
                { name: 'CryptoPunk Clone', type: 'nft', rarity: 'rare', value: 2.5, icon: '🖼️', description: 'Rare punk-style avatar.' },
                { name: 'Bored Ape Variant', type: 'nft', rarity: 'rare', value: 3.2, icon: '🖼️', description: 'Ape-inspired character.' },
                { name: 'Azuki Derivative', type: 'nft', rarity: 'rare', value: 2.8, icon: '🖼️', description: 'Anime-style character.' },
                
                // Epic
                { name: 'Original CryptoPunk', type: 'nft', rarity: 'epic', value: 50, icon: '🖼️', description: 'Authentic CryptoPunk NFT.' },
                { name: 'Bored Ape #6969', type: 'nft', rarity: 'epic', value: 80, icon: '🖼️', description: 'Rare trait combination.' },
                { name: 'Moonbird Elite', type: 'nft', rarity: 'epic', value: 65, icon: '🖼️', description: 'Premium bird character.' },
                
                // Legendary
                { name: 'Alien CryptoPunk', type: 'nft', rarity: 'legendary', value: 500, icon: '🖼️', description: 'Ultra-rare alien trait.' },
                { name: 'Golden Ape', type: 'nft', rarity: 'legendary', value: 800, icon: '🖼️', description: 'Legendary golden ape.' }
            ],
            
            collectible: [
                // Common
                { name: 'Pokemon Card Base', type: 'collectible', rarity: 'common', value: 15, icon: '🎴', description: 'Common Pokemon trading card.' },
                { name: 'Baseball Card', type: 'collectible', rarity: 'common', value: 12, icon: '🎴', description: 'Vintage baseball player card.' },
                { name: 'Magic Card Common', type: 'collectible', rarity: 'common', value: 8, icon: '🎴', description: 'Magic: The Gathering common.' },
                { name: 'Yu-Gi-Oh Monster', type: 'collectible', rarity: 'common', value: 10, icon: '🎴', description: 'Anime trading card game.' },
                { name: 'Marvel Comic Book', type: 'collectible', rarity: 'common', value: 18, icon: '📚', description: 'Classic superhero comic.' },
                
                // Rare
                { name: 'Charizard Holographic', type: 'collectible', rarity: 'rare', value: 250, icon: '🎴', description: 'Holographic Charizard card.' },
                { name: 'Babe Ruth Card', type: 'collectible', rarity: 'rare', value: 300, icon: '🎴', description: 'Vintage Babe Ruth card.' },
                { name: 'Black Lotus Magic', type: 'collectible', rarity: 'rare', value: 400, icon: '🎴', description: 'Powerful Magic card.' },
                
                // Epic
                { name: 'First Edition Charizard', type: 'collectible', rarity: 'epic', value: 2000, icon: '🎴', description: 'First edition holographic.' },
                { name: 'Mickey Mantle Rookie', type: 'collectible', rarity: 'epic', value: 3500, icon: '🎴', description: 'Rookie card legend.' },
                { name: 'Alpha Black Lotus', type: 'collectible', rarity: 'epic', value: 5000, icon: '🎴', description: 'Alpha edition Magic card.' },
                
                // Legendary
                { name: 'Pikachu Illustrator', type: 'collectible', rarity: 'legendary', value: 15000, icon: '🎴', description: 'Ultra-rare promotional card.' },
                { name: 'T206 Honus Wagner', type: 'collectible', rarity: 'legendary', value: 25000, icon: '🎴', description: 'Holy grail of baseball cards.' }
            ],
            
            gaming: [
                // Common
                { name: 'CS:GO Skin AK-47', type: 'gaming', rarity: 'common', value: 25, icon: '🎮', description: 'Basic weapon skin.' },
                { name: 'Fortnite Pickaxe', type: 'gaming', rarity: 'common', value: 15, icon: '⛏️', description: 'Common harvesting tool.' },
                { name: 'Minecraft Texture Pack', type: 'gaming', rarity: 'common', value: 5, icon: '🧱', description: 'Custom block textures.' },
                
                // Rare
                { name: 'Valorant Phantom Skin', type: 'gaming', rarity: 'rare', value: 75, icon: '🎮', description: 'Premium weapon skin.' },
                { name: 'Rocket League Car', type: 'gaming', rarity: 'rare', value: 100, icon: '🚗', description: 'Limited edition vehicle.' },
                { name: 'Apex Legends Heirloom', type: 'gaming', rarity: 'rare', value: 150, icon: '⚔️', description: 'Rare melee weapon.' },
                
                // Epic
                { name: 'CS:GO Dragon Lore', type: 'gaming', rarity: 'epic', value: 2500, icon: '🎮', description: 'Legendary AWP skin.' },
                { name: 'Fortnite Black Knight', type: 'gaming', rarity: 'epic', value: 1500, icon: '🏰', description: 'Rare battle pass skin.' },
                
                // Legendary
                { name: 'CS:GO Karambit Fade', type: 'gaming', rarity: 'legendary', value: 8000, icon: '🗡️', description: 'Ultra-rare knife skin.' },
                { name: 'Fortnite Renegade Raider', type: 'gaming', rarity: 'legendary', value: 5000, icon: '🪖', description: 'Original rare skin.' }
            ],
            
            premium: [
                // Premium Sneakers (higher values)
                { name: 'Air Runner Basic Premium', type: 'sneaker', rarity: 'rare', value: 50, icon: '👟', description: 'Premium version of basic running shoe.' },
                { name: 'Classic Canvas Elite', type: 'sneaker', rarity: 'rare', value: 60, icon: '👟', description: 'Elite canvas sneakers.' },
                { name: 'Street Walker Pro', type: 'sneaker', rarity: 'rare', value: 40, icon: '👟', description: 'Professional street shoes.' },
                { name: 'Air Jordan Retro Premium', type: 'sneaker', rarity: 'epic', value: 300, icon: '👟', description: 'Premium basketball heritage.' },
                { name: 'Nike Dunk Platinum', type: 'sneaker', rarity: 'epic', value: 360, icon: '👟', description: 'Platinum edition colorway.' },
                { name: 'Off-White x Nike Premium', type: 'sneaker', rarity: 'legendary', value: 1600, icon: '👟', description: 'Premium designer collaboration.' },
                { name: 'Travis Scott Jordan Elite', type: 'sneaker', rarity: 'legendary', value: 2400, icon: '👟', description: 'Elite artist collaboration.' },
                
                // Premium NFTs (higher values)
                { name: 'Pixel Avatar Premium', type: 'nft', rarity: 'rare', value: 0.3, icon: '🖼️', description: 'Premium pixel art avatar.' },
                { name: 'Digital Landscape Elite', type: 'nft', rarity: 'rare', value: 0.24, icon: '🖼️', description: 'Elite AI-generated landscape.' },
                { name: 'CryptoPunk Clone Premium', type: 'nft', rarity: 'epic', value: 7.5, icon: '🖼️', description: 'Premium punk-style avatar.' },
                { name: 'Bored Ape Elite', type: 'nft', rarity: 'epic', value: 9.6, icon: '🖼️', description: 'Elite ape-inspired character.' },
                { name: 'Original CryptoPunk Premium', type: 'nft', rarity: 'legendary', value: 150, icon: '🖼️', description: 'Premium CryptoPunk NFT.' },
                
                // Premium Collectibles (higher values)
                { name: 'Pokemon Card Premium', type: 'collectible', rarity: 'rare', value: 22, icon: '🎴', description: 'Premium Pokemon trading card.' },
                { name: 'Baseball Card Elite', type: 'collectible', rarity: 'rare', value: 18, icon: '🎴', description: 'Elite baseball player card.' },
                { name: 'Charizard Holo Premium', type: 'collectible', rarity: 'epic', value: 375, icon: '🎴', description: 'Premium holographic Charizard.' },
                { name: 'Babe Ruth Elite', type: 'collectible', rarity: 'epic', value: 450, icon: '🎴', description: 'Elite Babe Ruth card.' },
                { name: 'First Edition Charizard Premium', type: 'collectible', rarity: 'legendary', value: 3000, icon: '🎴', description: 'Premium first edition holo.' },
                
                // Premium Gaming Items
                { name: 'CS:GO Skin Premium', type: 'gaming', rarity: 'rare', value: 50, icon: '🎮', description: 'Premium weapon skin.' },
                { name: 'Fortnite Pickaxe Elite', type: 'gaming', rarity: 'rare', value: 30, icon: '⛏️', description: 'Elite harvesting tool.' },
                { name: 'CS:GO Dragon Lore Premium', type: 'gaming', rarity: 'epic', value: 5000, icon: '🎮', description: 'Premium AWP skin.' },
                { name: 'CS:GO Karambit Premium', type: 'gaming', rarity: 'legendary', value: 16000, icon: '🗡️', description: 'Premium knife skin.' },
                
                // Mythic items (only in premium boxes)
                { name: 'Nike Air Yeezy 2 Red October', type: 'sneaker', rarity: 'mythic', value: 10000, icon: '👟', description: 'Kanye West\'s legendary design.' },
                { name: 'Original Ethereum Genesis', type: 'nft', rarity: 'mythic', value: 2000, icon: '🖼️', description: 'Historic blockchain artifact.' },
                { name: 'Action Comics #1', type: 'collectible', rarity: 'mythic', value: 50000, icon: '🎴', description: 'First Superman appearance.' },
                { name: 'CS:GO Blue Gem AK', type: 'gaming', rarity: 'mythic', value: 25000, icon: '🎮', description: 'Rarest CS:GO skin pattern.' }
            ]
        };
        
        return itemPools[type] || [];
    }

    displayRevealedItem(item) {
        console.log('Displaying item:', item); // Debug log
        
        const resultRarity = document.getElementById('result-rarity');
        const resultImage = document.getElementById('result-image');
        const resultName = document.getElementById('result-name');
        const resultValue = document.getElementById('result-value');
        const resultDescription = document.getElementById('result-description');

        if (!resultRarity || !resultImage || !resultName || !resultValue || !resultDescription) {
            console.error('Missing result display elements');
            return;
        }

        resultRarity.textContent = item.rarity.toUpperCase();
        resultRarity.className = `result-rarity ${item.rarity}`;
        resultRarity.style.background = this.rarityColors[item.rarity];
        resultRarity.style.color = 'white';

        resultImage.innerHTML = item.icon;
        resultImage.className = `result-image ${item.rarity}`;
        resultImage.style.borderColor = this.rarityColors[item.rarity];
        resultImage.style.color = this.rarityColors[item.rarity];

        resultName.textContent = item.name;
        
        if (item.type === 'nft') {
            resultValue.textContent = `${item.value} ETH`;
        } else {
            resultValue.textContent = `$${item.value.toLocaleString()}`;
        }
        
        resultDescription.textContent = item.description;

        // Add sparkle effect for rare items
        if (['epic', 'legendary', 'mythic'].includes(item.rarity)) {
            this.addSparkleEffect(resultImage);
        }
    }

    addSparkleEffect(element) {
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                const sparkle = document.createElement('div');
                sparkle.innerHTML = '✨';
                sparkle.style.position = 'absolute';
                sparkle.style.fontSize = '1rem';
                sparkle.style.pointerEvents = 'none';
                sparkle.style.left = Math.random() * 100 + '%';
                sparkle.style.top = Math.random() * 100 + '%';
                sparkle.style.animation = 'sparkle 1s ease-out forwards';
                
                element.style.position = 'relative';
                element.appendChild(sparkle);
                
                setTimeout(() => {
                    if (sparkle.parentNode) {
                        sparkle.parentNode.removeChild(sparkle);
                    }
                }, 1000);
            }, i * 100);
        }
    }

    addToInventory(item) {
        this.inventory.push(item);
        this.updateInventoryDisplay();
        // Save to Firebase
        this.saveUserData();
    }

    updateInventoryDisplay() {
        const inventoryGrid = document.getElementById('inventory-grid');
        inventoryGrid.innerHTML = '';

        if (this.inventory.length === 0) {
            inventoryGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">No items in your collection yet. Open some mystery boxes to get started!</div>';
            return;
        }

        this.inventory.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = `inventory-item ${item.rarity}`;
            
            itemElement.innerHTML = `
                <div class="inventory-image" style="color: ${this.rarityColors[item.rarity]}">${item.icon}</div>
                <div class="inventory-name">${item.name}</div>
                <div class="inventory-value">${item.type === 'nft' ? item.value + ' ETH' : '$' + item.value.toLocaleString()}</div>
            `;
            
            inventoryGrid.appendChild(itemElement);
        });
    }

    updateLeaderboard(newItem) {
        const userName = 'You';
        const itemValue = newItem.type === 'nft' ? newItem.value * 3000 : newItem.value; // Convert ETH to USD for comparison
        
        // Add to all leaderboards
        Object.keys(this.leaderboardData).forEach(period => {
            let userEntry = this.leaderboardData[period].find(entry => entry.name === userName);
            
            if (userEntry) {
                userEntry.value += itemValue;
                userEntry.wins += 1;
                userEntry.bestItem = itemValue > (userEntry.bestItem || 0) ? newItem.name : userEntry.bestItem;
            } else {
                this.leaderboardData[period].push({
                    name: userName,
                    value: itemValue,
                    wins: 1,
                    bestItem: newItem.name,
                    avatar: 'Y'
                });
            }
            
            // Sort by value and keep top 10
            this.leaderboardData[period].sort((a, b) => b.value - a.value);
            this.leaderboardData[period] = this.leaderboardData[period].slice(0, 10);
        });
        
        this.generateLeaderboards();
    }

    generateSampleData() {
        const sampleUsers = [
            'CryptoKing', 'SneakerHead', 'CardMaster', 'DigitalArt', 'BoxOpener',
            'RareHunter', 'LegendSeeker', 'TradingPro', 'Collector99', 'MysteryFan'
        ];
        
        // Generate sample leaderboard data
        Object.keys(this.leaderboardData).forEach(period => {
            for (let i = 0; i < 8; i++) {
                const user = sampleUsers[i];
                const baseValue = Math.random() * 10000 + 1000;
                const multiplier = period === 'alltime' ? 5 : period === 'weekly' ? 2 : 1;
                
                this.leaderboardData[period].push({
                    name: user,
                    value: Math.floor(baseValue * multiplier),
                    wins: Math.floor(Math.random() * 50 + 10) * multiplier,
                    bestItem: this.getRandomItemName(),
                    avatar: user.charAt(0)
                });
            }
            
            this.leaderboardData[period].sort((a, b) => b.value - a.value);
        });
    }

    getRandomItemName() {
        const items = [
            'Legendary Sneaker', 'Rare NFT', 'Epic Card', 'Mythic Collectible',
            'Golden Item', 'Diamond Piece', 'Platinum Find', 'Ultra Rare'
        ];
        return items[Math.floor(Math.random() * items.length)];
    }

    generateLeaderboards() {
        Object.keys(this.leaderboardData).forEach(period => {
            const leaderboard = document.getElementById(`${period}-leaderboard`);
            leaderboard.innerHTML = '';
            
            this.leaderboardData[period].forEach((entry, index) => {
                const entryElement = document.createElement('div');
                entryElement.className = 'leaderboard-entry';
                
                let rankClass = '';
                if (index === 0) rankClass = 'first';
                else if (index === 1) rankClass = 'second';
                else if (index === 2) rankClass = 'third';
                
                entryElement.innerHTML = `
                    <div class="leaderboard-rank ${rankClass}">#${index + 1}</div>
                    <div class="leaderboard-avatar">${entry.avatar}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${entry.name}</div>
                        <div class="leaderboard-wins">${entry.wins} wins • Best: ${entry.bestItem}</div>
                    </div>
                    <div class="leaderboard-value">$${entry.value.toLocaleString()}</div>
                `;
                
                leaderboard.appendChild(entryElement);
            });
        });
    }

    generateSampleInventory() {
        // Add a few sample items to show the inventory system
        const sampleItems = [
            { name: 'Welcome Sneaker', type: 'sneaker', rarity: 'common', value: 50, icon: '👟', description: 'Your first mystery box item!' },
            { name: 'Starter NFT', type: 'nft', rarity: 'rare', value: 0.5, icon: '🖼️', description: 'A digital collectible to begin your journey.' }
        ];
        
        sampleItems.forEach(item => {
            this.inventory.push({
                ...item,
                id: Date.now() + Math.random(),
                unboxedAt: new Date()
            });
        });
        
        this.updateInventoryDisplay();
    }

    updateBalanceDisplay() {
        document.getElementById('user-balance').textContent = this.userBalance.toLocaleString();
    }

    updateStats() {
        // Animate the hero stats
        this.animateCounter('total-opened', 12847);
        this.animateCounter('total-value', 2400000, '$', 'M');
        this.animateCounter('active-users', 3421);
    }

    animateCounter(elementId, target, prefix = '', suffix = '') {
        const element = document.getElementById(elementId);
        const duration = 2000;
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            
            let displayValue = Math.floor(current);
            if (suffix === 'M') {
                displayValue = (displayValue / 1000000).toFixed(1);
            }
            
            element.textContent = prefix + displayValue.toLocaleString() + suffix;
        }, 16);
    }

    startParticleAnimation() {
        // Create floating particles in the background
        const particlesBg = document.getElementById('particles-bg');
        
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                this.createParticle(particlesBg);
            }, i * 100);
        }
        
        // Continuously create new particles
        setInterval(() => {
            this.createParticle(particlesBg);
        }, 2000);
    }

    createParticle(container) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = '4px';
        particle.style.height = '4px';
        particle.style.background = `hsl(${Math.random() * 60 + 220}, 70%, 60%)`;
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = '100%';
        particle.style.pointerEvents = 'none';
        particle.style.opacity = '0.6';
        particle.style.animation = `float-up ${Math.random() * 10 + 10}s linear infinite`;
        
        container.appendChild(particle);
        
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, 20000);
    }

    showCreditModal() {
        const modal = document.getElementById('credit-modal');
        modal.classList.add('active');
    }

    closeCreditModal() {
        const modal = document.getElementById('credit-modal');
        modal.classList.remove('active');
    }

    closeModal() {
        const modal = document.getElementById('opening-modal');
        modal.classList.remove('active');
    }

    // Authentication Modal Methods
    showLoginModal() {
        const modal = document.getElementById('login-modal');
        modal.classList.add('active');
    }

    showRegisterModal() {
        const modal = document.getElementById('register-modal');
        modal.classList.add('active');
    }

    closeAuthModal() {
        const loginModal = document.getElementById('login-modal');
        const registerModal = document.getElementById('register-modal');
        loginModal.classList.remove('active');
        registerModal.classList.remove('active');
    }

    switchToRegister() {
        this.closeAuthModal();
        this.showRegisterModal();
    }

    switchToLogin() {
        this.closeAuthModal();
        this.showLoginModal();
    }

    // Firebase Authentication Methods
    async loginUser() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        try {
            await auth.signInWithEmailAndPassword(email, password);
            this.closeAuthModal();
            this.showNotification('Login successful!', 'success');
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification(this.getAuthErrorMessage(error.code), 'error');
        }
    }

    async registerUser() {
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm').value;

        if (!username || !email || !password || !confirmPassword) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        if (username.length < 3) {
            this.showNotification('Username must be at least 3 characters', 'error');
            return;
        }
        
        if (username.includes('@')) {
            this.showNotification('Username cannot contain @ symbol', 'error');
            return;
        }
        
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            this.showNotification('Username can only contain letters, numbers, underscores, and dashes', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            // Check if username is already taken
            const usernameQuery = await db.collection('users').where('username', '==', username).get();
            if (!usernameQuery.empty) {
                this.showNotification('Username is already taken', 'error');
                return;
            }

            // Create user account
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            
            // Store username temporarily for use in auth state change
            this.pendingUsername = username;
            
            this.closeAuthModal();
            this.showNotification('Account created successfully!', 'success');
        } catch (error) {
            console.error('Registration error:', error);
            this.showNotification(this.getAuthErrorMessage(error.code), 'error');
        }
    }

    async signInWithGoogle() {
        try {
            const result = await auth.signInWithPopup(provider);
            
            // Don't manually load user data here - let onAuthStateChanged handle it
            this.closeAuthModal();
            this.showNotification('Google sign-in successful!', 'success');
        } catch (error) {
            console.error('Google sign-in error:', error);
            this.showNotification('Google sign-in failed', 'error');
        }
    }

    async logoutUser() {
        try {
            await auth.signOut();
            this.showNotification('Logged out successfully', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            this.showNotification('Error logging out', 'error');
        }
    }

    getAuthErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/user-not-found':
                return 'No account found with this email';
            case 'auth/wrong-password':
                return 'Incorrect password';
            case 'auth/email-already-in-use':
                return 'Email is already registered';
            case 'auth/weak-password':
                return 'Password is too weak';
            case 'auth/invalid-email':
                return 'Invalid email address';
            case 'auth/user-disabled':
                return 'Account has been disabled';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Try again later.';
            default:
                return 'Authentication error occurred';
        }
    }

    purchaseCredits(amount, price) {
        if (!this.user) {
            this.showNotification('Please login to purchase credits', 'error');
            return;
        }
        
        // Simulate payment processing
        this.showNotification(`Purchased ${amount} credits for $${price}!`, 'success');
        this.userBalance += amount;
        this.updateBalanceDisplay();
        this.closeCreditModal();
        // Save to Firebase
        this.saveUserData();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--error-color)' : 'var(--primary-color)'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 3000;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transform: translateX(400px);
            transition: transform 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Global functions for HTML event handlers
function openBox(type, price) {
    app.openBox(type, price);
}

function closeModal() {
    app.closeModal();
}

function closeCreditModal() {
    app.closeCreditModal();
}

function purchaseCredits(amount, price) {
    app.purchaseCredits(amount, price);
}

// Authentication global functions
function loginUser() {
    app.loginUser();
}

function registerUser() {
    app.registerUser();
}

function signInWithGoogle() {
    app.signInWithGoogle();
}

function closeAuthModal() {
    app.closeAuthModal();
}

function switchToRegister() {
    app.switchToRegister();
}

function switchToLogin() {
    app.switchToLogin();
}

function showLeaderboard(period) {
    // Hide all leaderboards
    document.querySelectorAll('.leaderboard').forEach(lb => {
        lb.classList.remove('active');
    });
    
    // Show selected leaderboard
    document.getElementById(`${period}-leaderboard`).classList.add('active');
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

function filterInventory(filter) {
    const items = document.querySelectorAll('.inventory-item');
    
    items.forEach(item => {
        if (filter === 'all') {
            item.style.display = 'block';
        } else {
            const itemName = item.querySelector('.inventory-name').textContent.toLowerCase();
            let showItem = false;
            
            switch(filter) {
                case 'sneaker':
                    showItem = itemName.includes('sneaker') || itemName.includes('jordan') || 
                              itemName.includes('nike') || itemName.includes('adidas') || 
                              itemName.includes('yeezy') || itemName.includes('runner') ||
                              itemName.includes('canvas') || itemName.includes('trainer');
                    break;
                case 'nft':
                    showItem = itemName.includes('nft') || itemName.includes('pixel') || 
                              itemName.includes('crypto') || itemName.includes('ape') || 
                              itemName.includes('digital') || itemName.includes('avatar') ||
                              itemName.includes('landscape') || itemName.includes('ethereum');
                    break;
                case 'collectible':
                    showItem = itemName.includes('card') || itemName.includes('collectible') || 
                              itemName.includes('pokemon') || itemName.includes('baseball') || 
                              itemName.includes('magic') || itemName.includes('comic') ||
                              itemName.includes('charizard') || itemName.includes('ruth');
                    break;
                case 'gaming':
                    showItem = itemName.includes('cs:go') || itemName.includes('fortnite') || 
                              itemName.includes('minecraft') || itemName.includes('valorant') || 
                              itemName.includes('rocket') || itemName.includes('apex') ||
                              itemName.includes('skin') || itemName.includes('karambit');
                    break;
            }
            
            item.style.display = showItem ? 'block' : 'none';
        }
    });
    
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

function scrollToBoxes() {
    document.getElementById('boxes').scrollIntoView({ behavior: 'smooth' });
}

// Add CSS animations dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes float-up {
        0% {
            transform: translateY(0) translateX(0);
            opacity: 0.6;
        }
        10% {
            opacity: 1;
        }
        90% {
            opacity: 1;
        }
        100% {
            transform: translateY(-100vh) translateX(${Math.random() * 200 - 100}px);
            opacity: 0;
        }
    }
    
    @keyframes sparkle {
        0% {
            transform: scale(0) rotate(0deg);
            opacity: 1;
        }
        50% {
            transform: scale(1) rotate(180deg);
            opacity: 1;
        }
        100% {
            transform: scale(0) rotate(360deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the app when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new MysteryBoxApp();
});

// Add some extra visual effects
document.addEventListener('mousemove', (e) => {
    const cursor = document.querySelector('.cursor-glow');
    if (!cursor) {
        const glowCursor = document.createElement('div');
        glowCursor.className = 'cursor-glow';
        glowCursor.style.cssText = `
            position: fixed;
            width: 20px;
            height: 20px;
            background: radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            transition: transform 0.1s ease;
        `;
        document.body.appendChild(glowCursor);
    }
    
    const glowElement = document.querySelector('.cursor-glow');
    if (glowElement) {
        glowElement.style.left = e.clientX - 10 + 'px';
        glowElement.style.top = e.clientY - 10 + 'px';
    }
});

// Add hover effects to mystery boxes
document.addEventListener('DOMContentLoaded', () => {
    const boxes = document.querySelectorAll('.mystery-box');
    boxes.forEach(box => {
        box.addEventListener('mouseenter', () => {
            const box3d = box.querySelector('.box-3d');
            if (box3d) {
                box3d.style.animationPlayState = 'paused';
                box3d.style.transform = 'rotateX(15deg) rotateY(45deg) scale(1.1)';
            }
        });
        
        box.addEventListener('mouseleave', () => {
            const box3d = box.querySelector('.box-3d');
            if (box3d) {
                box3d.style.animationPlayState = 'running';
                box3d.style.transform = '';
            }
        });
    });
});
