pragma solidity 0.4.24;

import "./ownership/Ownable.sol";
import "./whitelist/Whitelist.sol";
import "./token/StokrToken.sol";
import "./token/StokrTokenFactory.sol";
import "./crowdsale/StokrCrowdsale.sol";
import "./crowdsale/StokrCrowdsaleFactory.sol";
import "./crowdsale/RateSourceInterface.sol";

contract StokrProjectManager is Ownable, RateSource {

    struct StokrProject {
        string name;
        Whitelist whitelist;
        StokrToken token;
        StokrCrowdsale crowdsale;
    }


    uint public deploymentBlockNumber;

    address public rateAdmin;
    uint public etherRate;

    Whitelist public currentWhitelist;
    StokrTokenFactory public tokenFactory;
    StokrCrowdsaleFactory public crowdsaleFactory;

    StokrProject[] public projects;


    /// @dev Log entry upon rate change event
    /// @param previous Previous rate in EUR cent per Ether
    /// @param current Current rate in EUR cent per Ether
    event RateChange(uint previous, uint current);



    modifier onlyRateAdmin() {
        require(msg.sender == rateAdmin, "Restricted to rate admin");
        _;
    }


    constructor(uint _etherRate) public {
        require(_etherRate > 0, "Initial rate is zero");

        deploymentBlockNumber = block.number;
        etherRate = _etherRate;
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
        uint[5] amounts,  // [tokenCapOfPublicSale, tokenCapOfPrivateSale, tokenGoal,
                          //  tokenPurchaseMinimum, tokenReservePerMill]
        uint[2] period,  // [openingTime, closingTime]
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
            amounts,
            period,
            wallets);

        token.setMinter(crowdsale);
        token.transferOwnership(roles[2]);  // to tokenOwner
        crowdsale.transferOwnership(roles[3]);  // to crowdsaleOwner

        projects.push(StokrProject(name, currentWhitelist, token, crowdsale));
    }

    function projectsCount() public view returns (uint) {
        return projects.length;
    }

    /// @dev Set rate, i.e. adjust to changes of EUR/ether exchange rate
    /// @param newRate Rate in Euro cent per ether
    function setRate(uint newRate) public onlyRateAdmin {
        // Rate changes beyond an order of magnitude are likely just typos
        require(etherRate / 10 < newRate && newRate < 10 * etherRate, "Rate change too big");

        if (newRate != etherRate) {
            emit RateChange(etherRate, newRate);

            etherRate = newRate;
        }
    }

}
