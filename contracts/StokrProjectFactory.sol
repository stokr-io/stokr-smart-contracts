pragma solidity 0.4.24;

import "./ownership/Ownable.sol";
import "./crowdsale/StokrCrowdsale.sol";
import "./token/StokrToken.sol";
import "./whitelist/Whitelist.sol";

contract StokrProjectFactory is Ownable {



  struct StokrProject {

    Whitelist whitelist;
    address stokrToken;
    //address stokrCrowdsale;
    string projectName;
  }

Whitelist currentWhitelist;

StokrProject[] public projects;

constructor(address _whitelist) {
  currentWhitelist=Whitelist(_whitelist);
}

  function createNewProject(
  string _name,
  string _symbol,
  address _profitDepositor,
  address _keyRecoverer,
  uint _tokenGoal,
  uint _tokenCap,
  uint _tokenPrice,
  uint _etherRate,
  address _rateAdmin,
  uint _openingTime,
  uint _closingTime,
  address _companyWallet,
  uint _tokenReserve,
  address _reserveAccount) onlyOwner {
  StokrToken token = new StokrToken(_name,_symbol, currentWhitelist, _profitDepositor, _keyRecoverer);
  //StokrCrowdsale crowdsale = new StokrCrowdsale(token,_tokenCap, _tokenGoal, _tokenPrice,_etherRate, _rateAdmin, _openingTime,_closingTime,_companyWallet,_tokenReserve, _reserveAccount);
  //projects.push(StokrProject(currentWhitelist,token,_name));
}
}
