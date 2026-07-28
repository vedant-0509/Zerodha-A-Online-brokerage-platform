import { Link } from "react-router-dom";

export default function Footer() {
    return(
        <>
        <div className="footer">
            <div className="footer-section1">
                <div className="non-col-div">
                    <Link to="/home"><img src="/images/logo.svg" alt="Logo" className="logo"/></Link>
                    <div className="non-col-div-para">
                        <p>© 2010 - 2026, Zerodha Broking Ltd.</p>
                        <p>All rights reserved.</p>
                    </div>
                
                    <div className="non-col-div-logo">
                        <i class="fa-brands fa-linkedin"></i>
                        <i class="fa-brands fa-instagram"></i>
                        <i class="fa-brands fa-whatsapp"></i>
                    </div>
                    <div className="border"></div>
                    <div className="playstore">
                        <img src="/images/appstoreBadge.svg" alt="Logo" className="logo"/>
                        <img src="/images/googlePlayBadge.svg" alt="Logo" className="logo"/>
                    </div>
                </div>
                
                <div className="div1">
                    <p>Account</p>
                    <Link to="/">Open demat account</Link>
                    <Link to="/">Minor demat account</Link>
                    <Link to="/">NRI demat account</Link>
                    <Link to="/">HUF demat account</Link>
                    <Link to="/">Commodity</Link>
                    <Link to="/">Dematerialisation</Link>
                    <Link to="/">Fund transfer</Link>
                    <Link to="/">MTF</Link>
                </div>
                <div className="div2">
                    <p>Support</p>
                    <Link to="/">Contact us</Link>
                    <Link to="/">Support portal</Link>
                    <Link to="/">How to file a complaint?</Link>
                    <Link to="/">Status of your complaints</Link>
                    <Link to="/">Bulletin</Link>
                    <Link to="/">Circular</Link>
                    <Link to="/">Z-Connect blog</Link>
                    <Link to="/">Downloads</Link>
                </div>
                <div className="div3">
                    <p>Company</p>
                    <Link to="/">About</Link>
                    <Link to="/">Philosophy</Link>
                    <Link to="/">Press & media</Link>                
                    <Link to="/">Careers</Link>                      
                    <Link to="/">Zerodha Cares (CSR)</Link>            
                    <Link to="/">Zerodha.tech</Link>                 
                    <Link to="/">Open source</Link>            
                    <Link to="/">Referral program</Link>
                </div>
                <div className="div4">
                    <p>Quick links</p>
                    <Link to="/">Upcoming IPOs</Link>
                    <Link to="/">Brokerage charges</Link>
                    <Link to="/">Market holidays</Link>
                    <Link to="/">Economic calendar</Link>
                    <Link to="/">Calculators</Link>
                    <Link to="/">Markets</Link>
                    <Link to="/">Sectors</Link>
                    <Link to="/">Gift Nifty</Link>
                </div>
            </div>

            <div className="footer-section2">
                <p>Zerodha Broking Ltd.: Member of NSE, BSE, MCX & MSEI – SEBI Registration no.: INZ000031633 CDSL/NSDL: Depository services through Zerodha Broking Ltd. – SEBI Registration no.: IN-DP-431-2019 Registered Address. Zerodha Broking Ltd., #153/154, 4th Cross, Dollars Colony, Opp. Clarence Public School, J.P Nagar 4th Phase, Bengaluru - 560078, Karnataka, India. For any complaints pertaining to securities broking please write to <Link>complaints@zerodha.com</Link>, for DP related to <Link>dp@zerodha.com</Link>. Please ensure you carefully read the Risk Disclosure Document as prescribed by SEBI | ICF</p>
                <p>Procedure to file a complaint on <Link>SEBI SCORES:</Link> Register on SCORES portal. Mandatory details for filing complaints on SCORES: Name, PAN, Address, Mobile Number, E-mail ID. Benefits: Effective Communication, Speedy redressal of the grievances</p>
                <p><Link>Smart Online Dispute Resolution</Link> | <Link>Grievances Redressal Mechanism</Link></p>
                <p>Investments in securities market are subject to market risks; read all the related documents carefully before investing.</p>
                <p>Attention investors: 1) Stock brokers can accept securities as margins from clients only by way of pledge in the depository system w.e.f September 01, 2020. 2) Update your e-mail and phone number with your stock broker / depository participant and receive OTP directly from depository on your e-mail and/or mobile number to create pledge. 3) Check your securities / MF / bonds in the consolidated account statement issued by NSDL/CDSL every month.</p>
                <p>India's largest broker based on networth as per NSE. <Link>NSE broker factsheet</Link></p>
                <p>"Prevent unauthorised transactions in your account. Update your mobile numbers/email IDs with your stock brokers/depository participants. Receive information of your transactions directly from Exchange/Depositories on your mobile/email at the end of the day. Issued in the interest of investors. KYC is one time exercise while dealing in securities markets - once KYC is done through a SEBI registered intermediary (broker, DP, Mutual Fund etc.), you need not undergo the same process again when you approach another intermediary." Dear Investor, if you are subscribing to an IPO, there is no need to issue a cheque. Please write the Bank account number and sign the IPO application form to authorize your bank to make payment in case of allotment. In case of non allotment the funds will remain in your bank account. As a business we don't give stock tips, and have not authorized anyone to trade on behalf of others. If you find anyone claiming to be part of Zerodha and offering such services, please <Link>create a ticket here.</Link></p>
                <p>*Customers availing insurance advisory services offered by Ditto (Tacterial Consulting Private Limited | IRDAI Registered Corporate Agent (Composite) License No CA0738) will not have access to the exchange investor grievance redressal forum, SEBI SCORES/ODR, or arbitration mechanism for such products.</p>
                <p>Fixed deposit products offered on this platform are third-party products (TPP) and are not Exchange traded products. These are offered through Blostem Fintech Private Limited. Zerodha Broking Limited (SEBI Registration No.: INZ000031633) is acting solely as a distributor for these products. Any disputes arising with respect to such distribution activity will not have access to SEBI SCORES/ODR, Exchange Investor Grievance Redressal Forum, or Arbitration mechanism. Fixed deposits are regulated by the Reserve Bank of India (RBI).</p>
            </div>
            
            <div className="border"></div>
            
            <div className="footer-section3">
                <Link>NSE</Link>
                <p>|</p>
                <Link>BSE</Link>
                <p>|</p>
                <Link>MCX</Link>
                <p>|</p>
                <Link>MSEI</Link>
                <p>|</p>
                <Link>Terms & conditions</Link>
                <p>|</p>
                <Link>Policies & procedures</Link>
                <p>|</p>
                <Link>Privacy polic</Link>
                <p>|</p>
                <Link>Disclosure</Link>
                <p>|</p>
                <Link>Investor charter</Link>
            </div>
        </div>
        </>
    );
}