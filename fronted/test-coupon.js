import axios from 'axios';
axios.get('http://localhost:5000/api/v1/coupon/getallcoupon')
  .then(res => console.log(JSON.stringify(res.data, null, 2)))
  .catch(err => console.error(err.message));
