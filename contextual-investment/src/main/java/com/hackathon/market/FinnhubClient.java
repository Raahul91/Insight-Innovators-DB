package com.hackathon.market;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.hackathon.dto.FinnhubNews;
import com.hackathon.dto.FinnhubSearchResponse;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

@Component
public class FinnhubClient {

	@Autowired
    private RestClient restClient;

    @Value("${finhub.api-key}")
    private String apiKey;

    @Value("${finhub.base-url}")
    private String baseUrl;

    public String searchTicker(String instrumentName) {

        FinnhubSearchResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .scheme("https")
                        .host("finnhub.io")
                        .path("/api/v1/search")
                        .queryParam("q", instrumentName)
                        .queryParam("token", apiKey)
                        .build())
                .retrieve()
                .body(FinnhubSearchResponse.class);

        if (response == null ||
                response.result() == null ||
                response.result().isEmpty()) {

            throw new RuntimeException(
                    "Ticker not found for " + instrumentName);
        }

        return response.result()
                .stream()
                .filter(result ->
                        "Common Stock".equalsIgnoreCase(result.type()))
                .findFirst()
                .orElseThrow(() ->
                        new RuntimeException("Ticker not found"))
                .symbol();
    }

    public List<FinnhubNews> getCompanyNews(String ticker) {

        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(30);

        FinnhubNews[] response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .scheme("https")
                        .host("finnhub.io")
                        .path("/api/v1/company-news")
                        .queryParam("symbol", ticker)
                        .queryParam("from", from)
                        .queryParam("to", to)
                        .queryParam("token", apiKey)
                        .build())
                .retrieve()
                .body(FinnhubNews[].class);

        if (response == null) {
            return List.of();
        }

        return Arrays.stream(response)
                .limit(5)
                .toList();
    }

}