const axios = require("axios");
const { customError } = require("../../lib/CustomError");
const PathaoAuth = require("./PathaoAuth");

/**
 * Pathao's city / zone / area lists, read with the store's own Pathao account
 * (the same config and token store order booking uses). There are no built-in
 * credentials: a store without Pathao configured is refused before this is
 * built (getCourierConfig answers COURIER_NOT_CONFIGURED).
 */
class CityZone {
  /**
   * @param {object} merchant - courier config from getCourierConfig("pathao")
   */
  constructor(merchant) {
    this.baseURL = `${merchant.baseURL || "https://courier-api-sandbox.pathao.com"}/aladdin/api/v1`;
    this.auth = new PathaoAuth(merchant);
  }

  async get(path, what) {
    const token = await this.auth.getValidToken();
    try {
      const response = await axios.get(`${this.baseURL}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      });
      return response.data;
    } catch (err) {
      const status = err.response?.status;
      console.error(`Pathao ${what} error:`, err.response?.data || err.message);
      // Pathao refusing the request (e.g. an unknown city) is the caller's
      // error; Pathao failing or unreachable is a bad gateway, not our 500
      if (status >= 400 && status < 500) {
        throw new customError(
          err.response?.data?.message || `Pathao could not find the ${what}`,
          status,
        );
      }
      throw new customError(`Pathao did not answer the ${what} request`, 502);
    }
  }

  getCities() {
    return this.get("/city-list", "city list");
  }

  getZones(cityId) {
    return this.get(`/cities/${encodeURIComponent(cityId)}/zone-list`, "zone list");
  }

  // areas can be fetched from zones api
  async getAreas(zoneId) {
    const body = await this.get(`/zones/${encodeURIComponent(zoneId)}/area-list`, "area list");
    return body?.data;
  }
}

module.exports = CityZone;
