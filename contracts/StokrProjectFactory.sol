pragma solidity 0.4.24;

import "./ownership/Ownable.sol";
import "./crowdsale/StokrCrowdsale.sol";
import "./token/StokrToken.sol";
import "./whitelist/Whitelist.sol";

contract StokrProjectFactory is Ownable {



  struct StokrProject {

    Whitelist whitelist;
    address stokrToken;
    address stokrCrowdsale;
    string projectName;
  }

Whitelist currentWhitelist;

StokrProject[] public projects;

constructor(address _whitelist) public {
  currentWhitelist=Whitelist(_whitelist);
}

  function createNewProject(
  string _name,
  string _symbol,
  address[3] _roles,
  //roles[0] = _profitDepositor,
  //roles[1] = _keyRecoverer,
  //roles[2] = _rateAdmin,

  uint _tokenGoal,
  uint[2] _caps,
  //_caps[0] = _tokenCapOfPublicSale,
  //_caps[1] = _tokenCapOfPrivateSale,
  uint _tokenPrice,
  uint _etherRate,

  uint[2] _times,

  address[2] _wallets,
  // _wallets[0] = companyWallet
  // _wallets[1] = reserveAccount
  uint _tokenReserve
  ) public onlyOwner {
  StokrToken token = new StokrToken(_name,_symbol, currentWhitelist, _roles[0], _roles[1]);
  StokrCrowdsale crowdsale = new StokrCrowdsale(token, _caps[0], _caps[1], _tokenGoal, _tokenPrice, _etherRate, _roles[2], _times[0],_times[1], _wallets[0], _tokenReserve, _wallets[1]);
  projects.push(StokrProject(currentWhitelist,token,crowdsale,_name));
}
}
