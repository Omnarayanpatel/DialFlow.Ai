const userSchema = {
  id: "string",
  name: "string",
  email: "string",
  password: "string",
  role: "super_admin | admin | agent",
  createdAt: "date",
  updatedAt: "date",
};

module.exports = {
  userSchema,
};
