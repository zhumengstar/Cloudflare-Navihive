
const { compareSync, hashSync } = require('bcrypt-edge');

// Wrangler.jsonc 中的哈希
const hash = '$2y$10$vumnTIayAfQ1im0p2BrBI.u1qHPGb0L7AINytmRTFzctFwaUouHXa';
// 假设密码是 admin 或 123456，需要通过 hash-password 来验证
// 或者我们直接生成一个新的 $2y$ 和 $2a$ 哈希来对比

console.log('Testing bcrypt-edge compatibility...');

// 测试 $2a$ (标准 bcrypt)
const password = 'testpassword';
const hash2a = hashSync(password, 10);
console.log('Generated hash ($2b$ usually):', hash2a);
console.log('Verify self:', compareSync(password, hash2a));

// 测试 $2y$ (PHP 常用)
// 手动构造一个 $2y$ 哈希 (如果是兼容的，结构应该类似)
// 如果 bcrypt-edge 严格只支持 2a/2b，可能会失败
// 但通常 crypto implementation 会兼容
const hash2y = hash2a.replace('$2b$', '$2y$').replace('$2a$', '$2y$');
console.log('Modified hash to $2y$:', hash2y);

try {
    const result = compareSync(password, hash2y);
    console.log('Verify $2y$:', result);
} catch (e) {
    console.error('Error verifying $2y$:', e.message);
}
