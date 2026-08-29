import axios from 'axios';

async function test() {
  const { data } = await axios.get('http://165.99.165.19/api/v1/coupon/getallcoupon');
  const items = data?.data?.coupons || data?.data || [];
  console.log("items is array?", Array.isArray(items));
  if (!Array.isArray(items)) {
    console.log("items:", items);
  }
}
test();
