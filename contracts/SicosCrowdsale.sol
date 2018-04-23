pragma solidity 0.4.23;

import "../zeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol";
import "../zeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "./MintableToken.sol";


/// @title SicosCrowdsale
/// @author Autogenerated from a Dia UML diagram
contract SicosCrowdsale is RefundableCrowdsale, CappedCrowdsale {

    address public teamAccount;
    uint public teamShare;

    /// @dev Crowdsale
    /// @param _token An Ethereum address
    /// @param _openingTime A positive number
    /// @param _closingTime A positive number
    /// @param _goal A positive number
    /// @param _rate A positive number
    /// @param _cap A positive number
    /// @param _wallet An Ethereum address
    constructor(MintableToken _token,
                uint _openingTime,
                uint _closingTime,
                uint _goal,
                uint _rate,
                uint _cap,
                uint _teamShare,
                address _wallet)
        public
        RefundableCrowdsale(_goal)
        CappedCrowdsale(_cap)
        TimedCrowdsale(_openingTime, _closingTime)
        Crowdsale(_rate, _wallet, _token)
    {
        teamShare = _teamShare;
    }

    /// @dev Log entry on rate changed
    /// @param oldRate A positive number
    /// @param newRate A positive number
    event RateChanged(uint oldRate, uint newRate);

    /// @dev Set rate
    /// @param _newRate A positive number
    function setRate(uint _newRate) public onlyOwner {
        require(_newRate > 0);

        if (_newRate != rate) {
            emit RateChanged(rate, _newRate);
        }
        rate = _newRate;
    }

    /// @dev Set team account
    /// @param _teamAccount An Ethereum address.
    function setTeamAccount(address _teamAccount) public onlyOwner {
        require(_teamAccount != address(0x0));

        teamAccount = _teamAccount;
    }

    /// @dev Extend parent behavior requiring beneficiary to be identical to msg.sender
    /// @param _beneficiary Token purchaser
    /// @param _weiAmount Amount of wei contributed
    function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
        require(_beneficiary == msg.sender);

        super._preValidatePurchase(_beneficiary, _weiAmount);
    }

    /// @dev Extend parent behavior by minting a tokens for the benefit of beneficiary.
    /// @param _beneficiary Token recipient
    /// @param _tokenAmount Token amount
    function _deliverTokens(address _beneficiary, uint256 _tokenAmount) internal {
        MintableToken(token).mint(_beneficiary, _tokenAmount);
    }

    /// @dev Extend parent behavior to finish the token minting.
    function finalization() internal {
        require(teamAccount != address(0x0));

        super.finalization();

        MintableToken(token).mint(teamAccount, teamShare);
        MintableToken(token).finishMinting();
    }

}
