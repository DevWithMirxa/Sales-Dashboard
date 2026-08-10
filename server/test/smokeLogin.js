// Quick smoke test for dummy login (does not start the server)
process.env.USE_DUMMY_LOGIN = 'true';
process.env.DUMMY_PASSWORD = 'admin123';

const { loginUser } = require('../controllers/authController');

const req = { body: { email: 'test@example.com', password: 'admin123' } };

const res = {
    status(code) { this.statusCode = code; return this; },
    json(obj) { console.log('RESPONSE_JSON', JSON.stringify(obj, null, 2)); return this; },
    cookie(name, value, opts) { console.log('SET_COOKIE', name, value, opts); return this; }
};

(async () => {
    try {
        await loginUser(req, res);
    } catch (err) {
        console.error('ERROR', err);
    }
})();
