  const firebaseConfig = {
            apiKey: "AIzaSyCf0kahngmflEKhf-GEENdAwMIGiAjl-Bg",
            authDomain: "tec-ielts-master.firebaseapp.com",
            projectId: "tec-ielts-master",
            storageBucket: "tec-ielts-master.firebasestorage.app",
            messagingSenderId: "189299803974",
            appId: "1:189299803974:web:18e450f31050761bc60747"
        };
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const provider = new firebase.auth.GoogleAuthProvider();

        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const welcomeMsg = document.getElementById('welcome-msg');
        const testGrid = document.getElementById('test-grid');

        let isLoggedIn = false;
        let testListData = [];
        let currentSkill = 'R'; 

        async function loadTestList() {
            try {
                const response = await fetch('task_list.json');
                testListData = await response.json();
                renderTests(); 
            } catch (error) {
                testGrid.innerHTML = '<p style="color:red;">Lỗi tải dữ liệu đề thi!</p>';
                console.error(error);
            }
        }

        function loadSkill(skillPrefix, btnElement) {
            currentSkill = skillPrefix;
            
            document.querySelectorAll('.skill-btn').forEach(btn => btn.classList.remove('active'));
            if(btnElement) btnElement.classList.add('active');

            renderTests();
        }

        function renderTests() {
            testGrid.innerHTML = ''; 
            
            const filteredTests = testListData.filter(test => test.id.startsWith(currentSkill));

            if (filteredTests.length === 0) {
                testGrid.innerHTML = '<p style="color:#64748b;">Hiện chưa có bài thi cho kỹ năng này.</p>';
                return;
            }

            filteredTests.forEach(test => {
                const card = document.createElement('div');
                card.className = 'test-card';
                
                let cardHTML = `
                    <div>
                        <h3>${test.title}</h3>
                        <p>${test.subtitle}</p>
                    </div>
                `;

                if (isLoggedIn) {
                    cardHTML += `<button class="do-test-btn" style="display:block;" onclick="window.location.href='${test.url}'">Làm bài ngay</button>`;
                } else {
                    cardHTML += `<div class="lock-msg" style="display:block;">Đăng nhập để làm bài</div>`;
                }

                card.innerHTML = cardHTML;
                testGrid.appendChild(card);
            });
        }

        auth.onAuthStateChanged(user => {
            if (user) {
                isLoggedIn = true;
                loginBtn.style.display = 'none';
                logoutBtn.style.display = 'inline-block';
                welcomeMsg.innerHTML = `Chào mừng <b>${user.displayName}</b> quay trở lại!`;
            } else {
                isLoggedIn = false;
                loginBtn.style.display = 'inline-block';
                logoutBtn.style.display = 'none';
                welcomeMsg.innerHTML = 'Vui lòng đăng nhập để xem và làm bài!';
            }
            if (testListData.length > 0) {
                renderTests();
            }
        });

        loginBtn.addEventListener('click', () => auth.signInWithPopup(provider));
        logoutBtn.addEventListener('click', () => auth.signOut());

        loadTestList();
