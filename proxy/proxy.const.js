//set the url of the server you want to test your code with and start the development server using the following command:
// npm run start:proxy
const environments = {
    'tau': 'https://tau.primo.exlibrisgroup.com',
    'example': 'https://myPrimoVE.com',
  }

module.exports = {
  PROXY_TARGET: environments['tau']
}; 