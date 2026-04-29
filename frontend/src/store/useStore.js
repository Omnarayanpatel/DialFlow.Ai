const demoUser = {
  id: 2,
  name: "Rahul Sharma",
  email: "ravi.agent@callcrm.com",
  employeeId: "AM21612448",
  zohoId: "bi.avyaan.kolanjee",
  role: "agent",
};

const readStoredUser = () => {
  const rawUser = localStorage.getItem("user");

  if (!rawUser) {
    return demoUser;
  }

  try {
    return {
      ...demoUser,
      ...JSON.parse(rawUser),
    };
  } catch (_error) {
    return demoUser;
  }
};

export const useStore = () => {
  return {
    token: localStorage.getItem("token") || "",
    user: readStoredUser(),
  };
};
