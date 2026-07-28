import { useEffect, useState } from "react";
import axios from "axios";

export default function ExploreSection3() {

    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNews();
    }, []);

    async function fetchNews() {
        try {
            const response = await axios.get("http://localhost:3001/market-news");
            setNews(response.data);
        }
        catch (err) {
            console.log(err);
        }
        finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <h2>Loading News...</h2>;
    }

    return (
        <div className="news-section">
            <h2 className="news-heading">Market News Today</h2>

            <div className="news-container">
                {news.map((item, index) => (
                    <a key={index} href={item.link} target="_blank" rel="noreferrer" className="news-link">
                        <div className="news-card">
                            {item.image && (
                                <img src={item.image} alt={item.title} className="news-image" />
                            )}

                            <div className="news-content">
                                <div className="news-top">
                                    <span className="news-source">
                                        {item.source}
                                    </span>

                                    <span className="news-date">
                                        {new Date(
                                            item.published_at
                                        ).toLocaleDateString()}
                                    </span>
                                </div>

                                <h3 className="news-title">
                                    {item.title}
                                </h3>
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}