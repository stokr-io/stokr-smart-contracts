pragma solidity 0.4.24;

import "./MintingCrowdsale.sol";
import "./RateSourceInterface.sol";
import "../token/StokrToken.sol";

/// @title StokrCrowdsale
/// @author STOKR
contract StokrCrowdsale is MintingCrowdsale {

    // Soft cap in token units
    uint public tokenGoal;

    // As long as the goal is not reached funds of purchases are held back
    // and investments are assigned to investors here to enable a refunding
    // if the goal is missed upon finalization
    mapping(address => uint) public investments;


    // Log entry upon investor refund event
    event InvestorRefund(address indexed investor, uint value);


    /// @dev Constructor
    /// @param _token The token
    /// @param _tokenCapOfPublicSale Available token units for public sale
    /// @param _tokenCapOfPrivateSale Available token units for private sale
    /// @param _tokenGoal Minimum number of sold token units to be successful
    /// @param _tokenPurchaseMinimum Minimum amount of tokens an investor has to buy at once
    /// @param _tokenReservePerMill Additional reserve tokens in per mill of sold tokens
    /// @param _tokenPrice Price of a token in EUR cent
    /// @param _rateSource Ethereum address of ether rate setting authority
    /// @param _openingTime Block (Unix) timestamp of sale opening time
    /// @param _closingTime Block (Unix) timestamp of sale closing time
    /// @param _companyWallet Ethereum account who will receive sent ether
    /// @param _reserveAccount An address
    constructor(
        RateSource _rateSource,
        StokrToken _token,
        uint _tokenCapOfPublicSale,
        uint _tokenCapOfPrivateSale,
        uint _tokenGoal,
        uint _tokenPurchaseMinimum,
        uint _tokenReservePerMill,
        uint _tokenPrice,
        uint _openingTime,
        uint _closingTime,
        address _companyWallet,
        address _reserveAccount
    )
        public
        MintingCrowdsale(
            _rateSource,
            _token,
            _tokenCapOfPublicSale,
            _tokenCapOfPrivateSale,
            _tokenPurchaseMinimum,
            _tokenReservePerMill,
            _tokenPrice,
            _openingTime,
            _closingTime,
            _companyWallet,
            _reserveAccount
        )
    {
        require(_tokenGoal <= _tokenCapOfPublicSale + _tokenCapOfPrivateSale, "Goal is not attainable");

        tokenGoal = _tokenGoal;
    }

    /// @dev Wether the goal of sold tokens was reached or not
    /// @return True if the sale can be considered successful
    function goalReached() public view returns (bool) {
        return tokenSold() >= tokenGoal;
    }

    /// @dev Investors can claim refunds here if crowdsale was unsuccessful
    function distributeRefunds(address[] _investors) public onlyOwner {
        for (uint i = 0; i < _investors.length; ++i) {
            refundInvestor(_investors[i]);
        }
    }

    /// @dev Investors can claim refunds here if crowdsale was unsuccessful
    function claimRefund() public {
        refundInvestor(msg.sender);
    }

    /// @dev Refund an investor if the sale was not successful
    /// @param _investor Ethereum address of investor
    function refundInvestor(address _investor) internal {
        require(isFinalized, "Sale has not been finalized");
        require(!goalReached(), "Goal was reached");

        uint investment = investments[_investor];

        if (investment > 0) {
            investments[_investor] = 0;
            _investor.transfer(investment);

            emit InvestorRefund(_investor, investment);
        }
    }

    /// @dev Overwritten. Kill the token if goal was missed
    function finalize() public onlyOwner {
        super.finalize();

        if (!goalReached()) {
            StokrToken(token).destruct();
        }
    }

    /// @dev Overwritten. Funds are held back until goal was reached
    function forwardFunds() internal {
        if (goalReached()) {
            super.forwardFunds();
        }
        else {
            investments[msg.sender] = investments[msg.sender].add(msg.value);
        }
    }

}
