export default function ExploreSection6({ title, value, percent }) {
    const positive = Number(value) >= 0;

    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".75rem", }}>
            <span style={{ color: "#666", fontSize: "1rem", }}>{title}</span>

            <span style={{ color: title === "Invested" || title === "Current Value" ? "#424242" : positive ? "#00b386" : "#e53935", fontWeight: 600, }}>
                <p style={{margin:"0", fontWeight:"400"}}>
                    ₹{Math.abs(value).toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                    })}
                    {percent !== undefined && (
                        <>
                            {" "}
                            ({Number(percent) >= 0 ? "+" : ""}
                            {Number(percent).toFixed(2)}%)
                        </>
                    )}
                </p>
            </span>
        </div>
    );
}