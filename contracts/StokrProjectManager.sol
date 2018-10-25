pragma solidity 0.4.24;

import "./ownership/Ownable.sol";
import "./whitelist/Whitelist.sol";
import "./token/StokrToken.sol";
import "./token/StokrTokenFactory.sol";
import "./crowdsale/StokrCrowdsale.sol";
import "./crowdsale/StokrCrowdsaleFactory.sol";


contract StokrProjectManager is Ownable {

    struct StokrProject {
        string name;
        Whitelist whitelist;
        StokrToken token;
        StokrCrowdsale crowdsale;
    }


    address rateAdmin;
    uint etherRate;

    Whitelist currentWhitelist;
    StokrTokenFactory tokenFactory;
    StokrCrowdsaleFactory crowdsaleFactory;

    StokrProject[] public projects;
    StokrCrowdsale[] public activeCrowdsales;


    modifier onlyRateAdmin() {
        require(msg.sender == rateAdmin, "Restricted to rate admin");
        _;
    }


    constructor(uint initialRate) public {
        require(initialRate > 0, "Initial rate is zero");

        etherRate = initialRate;
    }


    function setRateAdmin(address newRateAdmin) public onlyOwner {
        require(newRateAdmin != address(0x0), "Rate admin is zero");

        rateAdmin = newRateAdmin;
    }

    function setWhitelist(Whitelist newWhitelist) public onlyOwner {
        require(address(newWhitelist) != address(0x0), "Whitelist is zero");

        currentWhitelist = newWhitelist;
    }

    function setTokenFactory(StokrTokenFactory newTokenFactory) public onlyOwner {
        require(address(newTokenFactory) != address(0x0), "Token factory is zero");

        tokenFactory = newTokenFactory;
    }

    function setCrowdsaleFactory(StokrCrowdsaleFactory newCrowdsaleFactory) public onlyOwner {
        require(address(newCrowdsaleFactory) != address(0x0), "Crowdsale factory is zero");

        crowdsaleFactory = newCrowdsaleFactory;
    }

    function createNewProject(
        string name,
        string symbol,
        uint tokenPrice,
        address[4] roles,  // [profitDepositor, keyRecoverer, tokenOwner, crowdsaleOwner]
        uint[4] caps,  // [tokenCapOfPublicSale, tokenCapOfPrivateSale, tokenGoal, tokenReserve]
        uint[2] times,  // [openingTime, closingTime]
        address[2] wallets  // [companyWallet, reserveAccount]
    )
        public onlyOwner
    {
        require(address(currentWhitelist) != address(0x0), "Whitelist is zero");
        require(address(tokenFactory) != address(0x0), "Token factory is zero");
        require(address(crowdsaleFactory) != address(0x0), "Crowdsale factory is zero");

        StokrToken token = tokenFactory.createNewToken(
            name,
            symbol,
            currentWhitelist,
            roles[0],  // profitDepositor
            roles[1]);  // keyRecoverer

        StokrCrowdsale crowdsale = crowdsaleFactory.createNewCrowdsale(
            token,
            tokenPrice,
            etherRate,
            caps,
            times,
            wallets);

        token.setMinter(crowdsale);
        token.transferOwnership(roles[2]);  // to tokenOwner
        crowdsale.transferOwnership(roles[3]);  // to crowdsaleOwner

        projects.push(StokrProject(name, currentWhitelist, token, crowdsale));
        activeCrowdsales.push(crowdsale);
    }

    function setRate(uint newRate) public onlyRateAdmin {
        for ((uint i, uint n) = (0, activeCrowdsales.length); i < n;) {
            if (activeCrowdsales[i].hasClosed()) {
                --n;
                activeCrowdsales[i] = activeCrowdsales[n];
                activeCrowdsales.length = n;
            }
            else {
                activeCrowdsales[i].setRate(newRate);
                ++i;
            }
        }

        etherRate = newRate;
    }

}
