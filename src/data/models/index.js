// import sequelize from '../sequelize';
// import User from './User';
// import UserLogin from './UserLogin';
// import UserClaim from './UserClaim';
// import UserProfile from './UserProfile';
//
// User.hasMany(UserLogin, {
//   foreignKey: 'userId',
//   as: 'logins',
//   onUpdate: 'cascade',
//   onDelete: 'cascade',
// });
//
// User.hasMany(UserClaim, {
//   foreignKey: 'userId',
//   as: 'claims',
//   onUpdate: 'cascade',
//   onDelete: 'cascade',
// });
//
// User.hasOne(UserProfile, {
//   foreignKey: 'userId',
//   as: 'profile',
//   onUpdate: 'cascade',
//   onDelete: 'cascade',
// });
//
// function sync(...args) {
//   return sequelize.sync(...args);
// }
//
// export default { sync };
// export { User, UserLogin, UserClaim, UserProfile };
