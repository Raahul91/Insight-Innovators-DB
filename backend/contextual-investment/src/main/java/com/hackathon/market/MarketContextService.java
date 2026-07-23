package com.hackathon.market;



import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.hackathon.dto.FinnhubNews;
import com.hackathon.dto.MarketContext;
import com.hackathon.dto.MarketNews;
import com.hackathon.service.InvestmentInsightService;

import java.util.Collections;
import java.util.List;

@Service
public class MarketContextService {

	private static final Log logger = LogFactory.getLog(MarketContextService.class);
	@Autowired
    private FinnhubClient finnhubClient;

    public MarketContext getMarketContext(String instrumentName) {

	try
	{

        String ticker = finnhubClient.searchTicker(instrumentName);
        
        logger.info("finding ticker for instrument : "+instrumentName+"");

        List<FinnhubNews> companyNews =
                finnhubClient.getCompanyNews(ticker);

        logger.info("finding news for ticker : "+ticker+"");
        
        List<MarketNews> marketNews = companyNews.stream()
                .map(news -> new MarketNews(
                        news.headline(),
                        news.summary(),
                        news.source()))
                .toList();

        return new MarketContext(marketNews);
	}
	catch (Exception ex) {
		logger.warn(
                    "Unable to fetch company news for "+instrumentName+". Falling back to AI knowledge.",
                    ex);

            return new MarketContext(Collections.emptyList());
		}
    }

}