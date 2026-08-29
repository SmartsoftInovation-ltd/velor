// import axios from "axios";

// const axiosSecure = axios.create({
//   baseURL: import.meta.env.VITE_API_URL,
//   withCredentials: true,
// });

// // const useAxiosSecure = () => {
// //   return axiosSecure;
// // };

// export default axiosSecure;
import axios from "axios";

const axiosSecure = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});
console.log(axiosSecure.interceptors.response.use);

axiosSecure.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

axiosSecure.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // Never retry the refresh-token endpoint itself
    const isRefreshRequest = originalRequest?.url?.includes("/auth/refresh-token");

    if (
      error.response &&
      error.response.status === 401 &&
      !isRefreshRequest
    ) {
      if (originalRequest._retry) {
        // Already retried once — refresh didn't help, give up
        localStorage.removeItem("accessToken");
        window.location.href = "/signin";
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        const { data } = await axiosSecure.post("/auth/refresh-token");
        const newToken = data?.data?.accessToken;
        if (!newToken) throw new Error("No access token in refresh response");

        localStorage.setItem("accessToken", newToken);
        axiosSecure.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;

        return axiosSecure(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("accessToken");
        window.location.href = "/signin";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosSecure;
